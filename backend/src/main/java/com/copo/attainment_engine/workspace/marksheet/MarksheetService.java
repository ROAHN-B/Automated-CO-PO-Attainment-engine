package com.copo.attainment_engine.workspace.marksheet;

import com.copo.attainment_engine.common.files.FileService;
import com.copo.attainment_engine.common.web.ApiException;
import com.copo.attainment_engine.workspace.Lifecycle.Cycle;
import com.copo.attainment_engine.workspace.Offering;
import com.copo.attainment_engine.workspace.OfferingService;
import com.copo.attainment_engine.workspace.cam.CamDocs;
import com.copo.attainment_engine.workspace.cam.CamService;
import com.copo.attainment_engine.workspace.qp.PaperRules;
import com.copo.attainment_engine.workspace.qp.QpDocs;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * API_CONTRACT §12: MS-1, MS-3 and MS-4. For ISE and ESE theory papers the structure is
 * generated when the faculty confirms the paper (§10.7.6) and is read-only. Finalizing
 * it puts its columns in the course workbook and opens marks entry.
 */
@Service
public class MarksheetService {

    @Document(collection = "assessmentStructures")
    public static class Structure {
        @Id public String assessmentId;
        public String offeringId;
        public String status = "DRAFT";            // DRAFT | FINALIZED
        public String source = "QUESTION_PAPER";   // QUESTION_PAPER | FACULTY
        public int version = 1;
        public List<StructureQuestion> questions = new ArrayList<>();
    }

    public static class StructureQuestion {
        public String questionNo;
        public List<StructureSub> subQuestions = new ArrayList<>();
        public QpDocs.AttemptRule attemptRule;
    }

    public static class StructureSub {
        public String label;          // "(a)(i)"
        public List<String> coIds = new ArrayList<>();
        public double maxMarks;
        public String bloomLevel;
    }

    public record StructureIssue(String code, String message) {}

    public record StructureView(String assessmentId, String offeringId, String assessmentName, double plannedMaxMarks,
                                String status, String source, int version, List<StructureQuestion> questions,
                                double computedMaxMarks, List<StructureIssue> issues, List<CamDocs.CourseOutcome> courseOutcomes) {}

    /** One workbook column per marksheet item: "Q1(a)(i)". */
    public record Column(String label, double maxMarks, List<String> coIds) {}

    private final MongoTemplate mongo;
    private final OfferingService offerings;
    private final CamService cams;
    private final FileService files;

    public MarksheetService(MongoTemplate mongo, OfferingService offerings, CamService cams, FileService files) {
        this.mongo = mongo;
        this.offerings = offerings;
        this.cams = cams;
        this.files = files;
    }

    /** MS-1 */
    public StructureView structure(String assessmentId) {
        Offering o = offerings.ownByAssessment(assessmentId);
        Cycle c = OfferingService.cycle(o, assessmentId);
        OfferingService.requireOpen(c.steps.marksheet);
        Structure s = mongo.findById(assessmentId, Structure.class);
        if (s == null) {
            throw ApiException.notFound(c.requiresPaperValidation
                    ? "Confirm the question paper to generate this marksheet."
                    : "The marksheet editor for activities, practicals and tutorials comes after the POE.");
        }
        return view(o, c, s);
    }

    /** MS-3: needs no issues; completes the step and fills the workbook block. */
    public StructureView finalize(String assessmentId, Integer version) {
        StructureView view = structure(assessmentId);
        Structure s = mongo.findById(assessmentId, Structure.class);
        if ("FINALIZED".equals(s.status)) throw ApiException.conflict("ALREADY_FINALIZED", "This marksheet is already finalized.");
        if (version == null || version != s.version) throw ApiException.versionConflict();
        if (!view.issues().isEmpty()) throw ApiException.precondition(view.issues().getFirst().message());
        s.status = "FINALIZED";
        s.version++;
        mongo.save(s);
        Offering o = offerings.ownByAssessment(assessmentId);
        offerings.marksheetFinalized(o, assessmentId);
        return view(o, OfferingService.cycle(o, assessmentId), s);
    }

    /** MS-4: the Excel template the faculty fills with marks (header rows, then one row per student). */
    public FileService.ExportFile template(String assessmentId) {
        StructureView s = structure(assessmentId);
        if (!"FINALIZED".equals(s.status())) throw ApiException.conflict("INVALID_STATE", "Finalize the marksheet before downloading its template.");
        Offering o = offerings.ownByAssessment(assessmentId);
        Map<String, String> code = s.courseOutcomes().stream().collect(Collectors.toMap(c -> c.coId, c -> c.code));
        List<Column> cols = columns(s.questions());
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet(s.assessmentName());
            CellStyle bold = wb.createCellStyle();
            Font font = wb.createFont();
            font.setBold(true);
            bold.setFont(font);
            String[][] head = {
                    header("Roll number", "Name", cols.stream().map(Column::label).toList()),
                    header("", "Max marks", cols.stream().map(c -> PaperRules.fmt(c.maxMarks())).toList()),
                    header("", "CO", cols.stream().map(c -> c.coIds().stream().map(id -> code.getOrDefault(id, id)).collect(Collectors.joining(" "))).toList()),
            };
            for (int r = 0; r < head.length; r++) {
                Row row = sheet.createRow(r);
                for (int i = 0; i < head[r].length; i++) {
                    row.createCell(i).setCellValue(head[r][i]);
                    row.getCell(i).setCellStyle(bold);
                }
            }
            int r = head.length;
            for (Offering.Student st : o.students) {
                Row row = sheet.createRow(r++);
                row.createCell(0).setCellValue(st.rollNumber);
                row.createCell(1).setCellValue(st.studentName);
            }
            sheet.setColumnWidth(0, 14 * 256);
            sheet.setColumnWidth(1, 26 * 256);
            wb.write(out);
            return files.store(o.course.courseCode + "_" + s.assessmentName() + "_marksheet_template.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());
        } catch (IOException e) {
            throw new IllegalStateException("Couldn't build the marksheet template", e);
        }
    }

    /* ----------------------------- used by QPV-6 / QPV-8 ----------------------------- */

    /** §10.7.6 mapping: each sub-question becomes a read-only marksheet item. */
    public void createFromPaper(QpDocs.Paper paper) {
        Structure s = new Structure();
        s.assessmentId = paper.assessmentId;
        s.offeringId = paper.offeringId;
        for (QpDocs.Question q : paper.questions) {
            StructureQuestion sq = new StructureQuestion();
            sq.questionNo = q.questionNo;
            sq.attemptRule = q.attemptRule;
            for (QpDocs.Flat f : QpDocs.flatten(q)) {
                StructureSub sub = new StructureSub();
                sub.label = f.part() != null ? "(" + f.part().label + ")(" + f.sub().label + ")" : "(" + f.sub().label + ")";
                sub.coIds = List.of(f.coId());
                sub.maxMarks = f.sub().marks;
                sub.bloomLevel = f.sub().expectedBloomLevel;
                sq.subQuestions.add(sub);
            }
            s.questions.add(sq);
        }
        mongo.save(s);
    }

    public void remove(String assessmentId) {
        Structure s = mongo.findById(assessmentId, Structure.class);
        if (s != null) mongo.remove(s);
    }

    public boolean isFinalized(String assessmentId) {
        Structure s = mongo.findById(assessmentId, Structure.class);
        return s != null && "FINALIZED".equals(s.status);
    }

    /** The finalized columns, for the workbook; null while the marksheet isn't finalized. */
    public List<Column> finalizedColumns(String assessmentId) {
        Structure s = mongo.findById(assessmentId, Structure.class);
        return s != null && "FINALIZED".equals(s.status) ? columns(s.questions) : null;
    }

    public static List<Column> columns(List<StructureQuestion> questions) {
        List<Column> out = new ArrayList<>();
        for (StructureQuestion q : questions) {
            for (StructureSub s : q.subQuestions) out.add(new Column(q.questionNo + s.label, s.maxMarks, s.coIds));
        }
        return out;
    }

    /** A question's marks: its sub-questions', with the attempt rule applied. */
    static double questionMarks(StructureQuestion q) {
        List<Double> marks = q.subQuestions.stream().map(s -> s.maxMarks).sorted(Comparator.reverseOrder()).toList();
        int take = q.attemptRule != null && q.attemptRule.attempt > 0 ? Math.min(q.attemptRule.attempt, marks.size()) : marks.size();
        return marks.subList(0, take).stream().mapToDouble(Double::doubleValue).sum();
    }

    private StructureView view(Offering o, Cycle c, Structure s) {
        double planned = offerings.plannedMaxMarks(o, s.assessmentId);
        double computed = s.questions.stream().mapToDouble(MarksheetService::questionMarks).sum();
        List<StructureIssue> issues = new ArrayList<>();
        if (s.questions.isEmpty()) issues.add(new StructureIssue("NO_QUESTIONS", "The marksheet has no questions."));
        else if (computed != planned) {
            issues.add(new StructureIssue("TOTAL_MISMATCH", "The marksheet adds up to " + PaperRules.fmt(computed)
                    + " marks, but the plan says " + PaperRules.fmt(planned) + "."));
        }
        return new StructureView(s.assessmentId, o.id, c.name, planned, s.status, s.source, s.version, s.questions,
                computed, issues, cams.courseOutcomes(o));
    }

    private static String[] header(String a, String b, List<String> rest) {
        List<String> all = new ArrayList<>(List.of(a, b));
        all.addAll(rest);
        return all.toArray(String[]::new);
    }
}
