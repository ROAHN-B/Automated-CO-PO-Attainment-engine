package com.copo.attainment_engine.workspace.workbook;

import com.copo.attainment_engine.common.response.ApiResponse;
import com.copo.attainment_engine.common.web.ApiException;
import com.copo.attainment_engine.workspace.Lifecycle.Cycle;
import com.copo.attainment_engine.workspace.Offering;
import com.copo.attainment_engine.workspace.OfferingService;
import com.copo.attainment_engine.workspace.cam.CamDocs;
import com.copo.attainment_engine.workspace.marksheet.MarksheetService;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * API_CONTRACT §14.4: the live course workbook, maintained by the backend and read-only
 * for faculty. Blocks exist only for the subject's planned assessments; a block gets its
 * question columns when that assessment's marksheet is finalized (MS-3). Attainment
 * values stay pending until marks are submitted and a run is approved (after the POE).
 */
@RestController
@RequestMapping("/api/v1/offerings/{offeringId}/workbook")
public class WorkbookController {

    public record HeaderRow(String label, String value, String pendingReason) {}
    public record CoSummary(String coCode, String statement, Double overall, String pendingReason) {}
    public record Main(List<HeaderRow> header, Map<String, Object> criteria, List<CoSummary> coSummary) {}
    public record OutcomeRef(String code, String kind, String shortName) {}
    public record MatrixRow(String coCode, Double coOverall, Map<String, Integer> correlations) {}
    public record PoPso(List<OutcomeRef> outcomes, List<MatrixRow> matrix, Map<String, Double> average,
                        Map<String, Integer> courseMapping, Map<String, Double> attainment) {}
    public record Question(String label, double maxMarks, List<String> coCodes, boolean appliesToAllCos) {}
    public record Block(String assessmentId, String name, String category, String phase, String status,
                        List<Question> questions, boolean canCalculate) {}
    public record Data(List<Block> blocks, int studentCount) {}
    public record Workbook(String offeringId, String template, String asOf, Main main, PoPso poPso, Data data) {}
    public record StudentRow(int serial, String rollNumber, String studentName, Map<String, Map<String, Object>> marks) {}
    public record Page<T>(List<T> content, int page, int size, long totalElements, int totalPages) {}

    /** The coordinator's targets (§15.8), at the institution workbook's defaults. */
    static final Map<String, Object> TARGETS = Map.of(
            "configId", "cfg-2026-ece", "version", 1,
            "ise", Map.of("weight", 0.4, "targetMarksPct", 60, "levelPct", Map.of("l1", 50, "l2", 60, "l3", 70)),
            "ese", Map.of(
                    "theory", Map.of("weight", 0.6, "targetMarksPct", 50, "levelPct", Map.of("l1", 60, "l2", 70, "l3", 80)),
                    "practical", Map.of("weight", 0.6, "targetMarksPct", 50, "levelPct", Map.of("l1", 50, "l2", 60, "l3", 70))),
            "directWeight", 0.8, "indirectWeight", 0.2,
            "updatedBy", "Dept. coordinator", "updatedAt", "2026-07-14T10:00:00Z");

    private final MongoTemplate mongo;
    private final OfferingService offerings;
    private final MarksheetService marksheets;

    public WorkbookController(MongoTemplate mongo, OfferingService offerings, MarksheetService marksheets) {
        this.mongo = mongo;
        this.offerings = offerings;
        this.marksheets = marksheets;
    }

    /** WB-1 */
    @GetMapping
    public ApiResponse<Workbook> workbook(@PathVariable String offeringId) {
        Offering o = offerings.own(offeringId);
        CamDocs.Cam cam = finalizedCam(o);
        Map<String, String> coCode = cam.inputs.courseOutcomes.stream().collect(Collectors.toMap(c -> c.coId, c -> c.code));
        String notCalculated = "Not calculated yet";

        List<HeaderRow> header = List.of(
                new HeaderRow("Class", o.className, null),
                new HeaderRow("Course", o.course.courseCode + ": " + o.course.courseName, null),
                new HeaderRow("Course coordinator", o.courseCoordinator != null ? o.courseCoordinator.fullName : null, "Not assigned"),
                new HeaderRow("Year", o.academicYear.name, null),
                new HeaderRow("Semester", String.valueOf(o.semester.semesterNumber), null),
                new HeaderRow("Class strength", String.valueOf(o.classStrength), null));
        List<CoSummary> coSummary = cam.inputs.courseOutcomes.stream()
                .map(c -> new CoSummary(c.code, c.statement, null, notCalculated)).toList();

        List<CamDocs.ProgramOutcome> outcomes = cam.inputs.programOutcomes;
        Map<String, String> outcomeCode = outcomes.stream().collect(Collectors.toMap(x -> x.outcomeId, x -> x.code));
        List<MatrixRow> matrix = new ArrayList<>();
        for (CamDocs.CourseOutcome co : cam.inputs.courseOutcomes) {
            Map<String, Integer> row = new LinkedHashMap<>();
            for (CamDocs.ProgramOutcome x : outcomes) row.put(x.code, null);
            cam.cells.stream().filter(c -> c.coId.equals(co.coId))
                    .forEach(c -> row.put(outcomeCode.getOrDefault(c.outcomeId, c.outcomeId), c.level));
            matrix.add(new MatrixRow(co.code, null, row));
        }
        // The CAM's average correlation per PO/PSO and its rounded course mapping (the workbook's CAM summary).
        Map<String, Double> average = new LinkedHashMap<>();
        Map<String, Integer> courseMapping = new LinkedHashMap<>();
        Map<String, Double> attainment = new LinkedHashMap<>();
        for (CamDocs.ProgramOutcome x : outcomes) {
            List<Integer> levels = matrix.stream().map(m -> m.correlations().get(x.code)).filter(v -> v != null).toList();
            Double avg = levels.isEmpty() ? null : Math.round(levels.stream().mapToInt(Integer::intValue).average().orElse(0) * 100) / 100.0;
            average.put(x.code, avg);
            courseMapping.put(x.code, avg == null ? null : (int) Math.round(avg));
            attainment.put(x.code, null);
        }
        PoPso poPso = new PoPso(outcomes.stream().map(x -> new OutcomeRef(x.code, x.kind, x.title != null ? x.title : x.code)).toList(),
                matrix, average, courseMapping, attainment);

        List<Block> blocks = new ArrayList<>();
        for (Cycle c : o.progress.cycles) {
            String status = c.steps.marksEntry.is("DONE") ? "FILLED"
                    : c.steps.marksEntry.is("AVAILABLE") || c.steps.marksEntry.is("IN_PROGRESS") ? "AWAITING_MARKS"
                    : c.steps.marksheet.is("AVAILABLE") || c.steps.marksheet.is("IN_PROGRESS") ? "AWAITING_MARKSHEET" : "LOCKED";
            List<MarksheetService.Column> cols = marksheets.finalizedColumns(c.assessmentId);
            List<Question> questions = cols == null ? List.of() : cols.stream()
                    .map(col -> new Question(col.label(), col.maxMarks(), col.coIds().stream().map(id -> coCode.getOrDefault(id, id)).toList(), false))
                    .toList();
            String phase = List.of("ESE", "POE", "OE", "OE_POE").contains(c.category) ? "ESE" : "ISE";
            blocks.add(new Block(c.assessmentId, c.name, c.category, phase, status, questions, false));
        }
        return ApiResponse.success(new Workbook(o.id, o.assessmentScheme, null, new Main(header, TARGETS, coSummary), poPso,
                new Data(blocks, o.students.size())));
    }

    /** WB-2: the Data sheet's student rows (marks fill in once marks entry is built). */
    @GetMapping("/data/students")
    public ApiResponse<Page<StudentRow>> students(@PathVariable String offeringId,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "50") int size,
                                                  @RequestParam(required = false) String search) {
        Offering o = offerings.own(offeringId);
        finalizedCam(o);
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<StudentRow> all = new ArrayList<>();
        int serial = 0;
        for (Offering.Student s : o.students) {
            serial++;
            if (!term.isEmpty() && !s.rollNumber.toLowerCase(Locale.ROOT).contains(term) && !s.studentName.toLowerCase(Locale.ROOT).contains(term)) continue;
            all.add(new StudentRow(serial, s.rollNumber, s.studentName, Map.of()));
        }
        int p = Math.max(0, page), n = Math.max(1, Math.min(size, 500));
        List<StudentRow> content = all.subList(Math.min(all.size(), p * n), Math.min(all.size(), p * n + n));
        return ApiResponse.success(new Page<>(content, p, n, all.size(), Math.max(1, (all.size() + n - 1) / n)));
    }

    private CamDocs.Cam finalizedCam(Offering o) {
        CamDocs.Cam cam = mongo.findOne(Query.query(Criteria.where("offeringId").is(o.id)), CamDocs.Cam.class);
        if (cam == null || !"FINALIZED".equals(cam.status)) throw ApiException.notFound("The workbook is generated when the CAM is finalized.");
        return cam;
    }
}
