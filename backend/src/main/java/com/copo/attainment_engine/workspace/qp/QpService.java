package com.copo.attainment_engine.workspace.qp;

import com.copo.attainment_engine.common.files.FileService;
import com.copo.attainment_engine.common.web.ApiException;
import com.copo.attainment_engine.workspace.Lifecycle.Cycle;
import com.copo.attainment_engine.workspace.Offering;
import com.copo.attainment_engine.workspace.OfferingService;
import com.copo.attainment_engine.workspace.ai.AiClient;
import com.copo.attainment_engine.workspace.cam.CamDocs;
import com.copo.attainment_engine.workspace.cam.CamService;
import com.copo.attainment_engine.workspace.marksheet.MarksheetService;
import com.copo.attainment_engine.workspace.qp.QpDocs.Flat;
import com.copo.attainment_engine.workspace.qp.QpDocs.Paper;
import com.copo.attainment_engine.workspace.qp.QpDocs.Result;
import com.copo.attainment_engine.workspace.qp.QpDocs.Validated;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * API_CONTRACT §10: QPV-1 to QPV-8. The faculty types the paper; the backend lists its
 * blocking issues, runs the AI review in the background (§10.7.5), computes the scores
 * deterministically, and on "Confirm paper" generates the read-only marksheet (§10.7.6).
 */
@Service
public class QpService {

    private static final Logger log = LoggerFactory.getLogger(QpService.class);
    /** An analysis that hasn't finished by now was lost (e.g. a restart). */
    private static final Duration STUCK = Duration.ofMinutes(5);

    public record PaperUpdate(Integer version, QpDocs.Header header, List<String> coIds, List<QpDocs.Question> questions) {}

    public record PaperView(String validationId, String offeringId, String assessmentId, String assessmentName,
                            String examCategory, String status, int version, QpDocs.Header header,
                            List<CamDocs.CourseOutcome> courseOutcomes, List<String> coIds, List<QpDocs.Question> questions,
                            double computedTotalMarks, List<PaperRules.Issue> issues, QpDocs.Error error,
                            Instant finalizedAt, Instant updatedAt, String updatedBy) {}

    private final MongoTemplate mongo;
    private final OfferingService offerings;
    private final CamService cams;
    private final MarksheetService marksheets;
    private final AiClient ai;
    private final FileService files;
    private final ExecutorService jobs = Executors.newVirtualThreadPerTaskExecutor();

    public QpService(MongoTemplate mongo, OfferingService offerings, CamService cams, MarksheetService marksheets,
                     AiClient ai, FileService files) {
        this.mongo = mongo;
        this.offerings = offerings;
        this.cams = cams;
        this.marksheets = marksheets;
        this.ai = ai;
        this.files = files;
    }

    /** The exam behind an assessment, with its step open (409 STAGE_LOCKED otherwise). */
    private record Exam(Offering o, Cycle c) {}

    private Exam exam(String assessmentId) {
        Offering o = offerings.ownByAssessment(assessmentId);
        Cycle c = OfferingService.cycle(o, assessmentId);
        if (c.steps.paperValidation == null) throw ApiException.notFound("Only ISE and ESE theory papers have a question paper.");
        OfferingService.requireOpen(c.steps.paperValidation);
        return new Exam(o, c);
    }

    /** QPV-1: the stored paper, or an unsaved empty draft (version 0, max marks from the plan). */
    public PaperView paper(String assessmentId) {
        Exam e = exam(assessmentId);
        Paper p = stored(assessmentId);
        if (p == null) {
            p = new Paper();
            p.validationId = "qpv-" + assessmentId;
            p.assessmentId = assessmentId;
            p.offeringId = e.o().id;
            p.header.maxMarks = offerings.plannedMaxMarks(e.o(), assessmentId);
        } else if ("ANALYZING".equals(p.status) && p.analysisStartedAt != null
                && p.analysisStartedAt.plus(STUCK).isBefore(Instant.now())) {
            fail(p, "UPSTREAM_TIMEOUT", "The analysis took too long. Try again.");
        }
        return view(e, p);
    }

    /** QPV-2: saves even with issues; an analysed paper goes back to DRAFT. */
    public PaperView save(String assessmentId, PaperUpdate u) {
        Exam e = exam(assessmentId);
        if (u.header() == null || u.questions() == null || u.coIds() == null) throw ApiException.validation("The paper is incomplete.", null);
        PaperRules.checkLimits(u.questions());
        Paper p = stored(assessmentId);
        if (p == null) {
            p = new Paper();
            p.validationId = "qpv-" + assessmentId;
            p.assessmentId = assessmentId;
            p.offeringId = e.o().id;
        }
        writable(p, u.version());
        if ("ANALYZING".equals(p.status)) throw ApiException.conflict("INVALID_STATE", "Wait for the analysis to finish before editing.");
        p.header = u.header();
        p.header.maxMarks = offerings.plannedMaxMarks(e.o(), assessmentId);   // always the plan's (§10.5)
        p.coIds = new ArrayList<>(u.coIds());
        p.questions = new ArrayList<>(u.questions());
        if (!"DRAFT".equals(p.status)) {
            p.status = "DRAFT";
            p.error = null;
            removeResult(assessmentId);
        }
        touch(p, e.o());
        offerings.paperStarted(e.o(), assessmentId);
        return view(e, mongo.save(p));
    }

    /** QPV-3: 202 ANALYZING; refused while issues remain. The AI runs in the background. */
    public PaperView validate(String assessmentId, Integer version) {
        Exam e = exam(assessmentId);
        Paper p = stored(assessmentId);
        if (p == null) throw ApiException.conflict("INVALID_STATE", "Save the paper first.");
        writable(p, version);
        if ("ANALYZING".equals(p.status)) throw ApiException.conflict("INVALID_STATE", "The paper is already being analysed.");
        if ("ANALYSIS_READY".equals(p.status)) throw ApiException.conflict("INVALID_STATE", "This version is already analysed.");
        List<PaperRules.Issue> issues = PaperRules.issues(p, cams.courseOutcomes(e.o()));
        if (!issues.isEmpty()) {
            throw ApiException.precondition("Fix the " + (issues.size() == 1 ? "problem" : issues.size() + " problems") + " in the paper first.");
        }
        p.status = "ANALYZING";
        p.error = null;
        p.analysisStartedAt = Instant.now();
        touch(p, e.o());
        Paper saved = mongo.save(p);
        Map<String, Object> request = aiRequest(e, saved);
        jobs.submit(() -> analyse(assessmentId, request));
        return view(e, saved);
    }

    /** QPV-4 */
    public Result result(String assessmentId) {
        exam(assessmentId);
        Result r = mongo.findById(assessmentId, Result.class);
        if (r == null) throw ApiException.notFound("This paper hasn’t been analysed yet.");
        return r;
    }

    /** QPV-5: the college's moderation sheet, ISE only, once the paper is analysed. */
    public FileService.ExportFile moderationSheet(String assessmentId, String format) {
        if (!"DOCX".equals(format) && !"PDF".equals(format)) throw ApiException.validation("Choose DOCX or PDF.", null);
        Exam e = exam(assessmentId);
        if (!"ISE".equals(e.c().category)) throw ApiException.notFound("ESE papers have no moderation sheet.");
        Paper p = stored(assessmentId);
        if (p == null || (!"ANALYSIS_READY".equals(p.status) && !"FINALIZED".equals(p.status))) {
            throw ApiException.conflict("INVALID_STATE", "Validate the paper before downloading the moderation sheet.");
        }
        ModerationSheet.Model m = ModerationSheet.model(e.o(), p, e.c().name, cams.courseOutcomes(e.o()));
        String base = e.o().course.courseCode + "_" + e.c().name + (p.header.setLabel != null ? "_Set" + p.header.setLabel : "") + "_moderation_sheet";
        return "DOCX".equals(format)
                ? files.store(base + ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ModerationSheet.docx(m))
                : files.store(base + ".pdf", "application/pdf", ModerationSheet.pdf(m));
    }

    /** QPV-6: Confirm paper. Locks it, completes the step and generates its read-only marksheet. */
    public PaperView confirm(String assessmentId, Integer version) {
        Exam e = exam(assessmentId);
        Paper p = stored(assessmentId);
        if (p == null) throw ApiException.conflict("INVALID_STATE", "Validate the paper with the AI before confirming it.");
        writable(p, version);
        if (!"ANALYSIS_READY".equals(p.status)) throw ApiException.conflict("INVALID_STATE", "Validate the paper with the AI before confirming it.");
        p.status = "FINALIZED";
        p.finalizedAt = Instant.now();
        touch(p, e.o());
        Paper saved = mongo.save(p);
        marksheets.createFromPaper(saved);
        offerings.paperConfirmed(e.o(), assessmentId);
        return view(exam(assessmentId), saved);
    }

    /** QPV-8: Reopen, allowed until the marksheet is finalized. */
    public PaperView reopen(String assessmentId, Integer version) {
        Exam e = exam(assessmentId);
        Paper p = stored(assessmentId);
        if (p == null || !"FINALIZED".equals(p.status)) throw ApiException.conflict("INVALID_STATE", "Only a confirmed paper can be reopened.");
        if (version == null || version != p.version) throw ApiException.versionConflict();
        if (marksheets.isFinalized(assessmentId)) {
            throw ApiException.conflict("INVALID_STATE", "The marksheet is finalized, so the paper can’t be reopened.");
        }
        p.status = "ANALYSIS_READY";
        p.finalizedAt = null;
        touch(p, e.o());
        Paper saved = mongo.save(p);
        marksheets.remove(assessmentId);
        offerings.paperReopened(e.o(), assessmentId);
        return view(e, saved);
    }

    /* ------------------------------ analysis job (§10.7.5) ------------------------------ */

    /** §10.6 QpValidationContext for Mayuri's service: ticked COs only, sub-questions in paper order. */
    private Map<String, Object> aiRequest(Exam e, Paper p) {
        Offering o = e.o();
        Set<String> ticked = new HashSet<>(p.coIds);
        List<Map<String, Object>> cos = cams.courseOutcomes(o).stream().filter(c -> ticked.contains(c.coId))
                .map(c -> Map.<String, Object>of("coId", c.coId, "code", c.code, "statement", c.statement)).toList();
        List<Map<String, Object>> subs = new ArrayList<>();
        for (Flat f : QpDocs.flatten(p.questions)) {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("questionNo", f.question().questionNo);
            s.put("partLabel", f.partLabel());
            s.put("label", f.sub().label);
            s.put("heading", f.question().heading);
            s.put("text", f.sub().text);
            s.put("type", f.sub().type);
            s.put("options", "MCQ".equals(f.sub().type) ? f.sub().options : null);
            s.put("marks", f.sub().marks);
            s.put("coId", f.coId());
            s.put("expectedBloomLevel", f.sub().expectedBloomLevel);
            subs.add(s);
        }
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("setLabel", blankToNull(p.header.setLabel));
        header.put("maxMarks", p.header.maxMarks);
        header.put("durationMinutes", p.header.durationMinutes);
        header.put("examDate", blankToNull(p.header.examDate));
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("course", Map.of("syllabusCourseId", o.course.syllabusCourseId, "courseCode", o.course.courseCode,
                "courseName", o.course.courseName, "assessmentScheme", "THEORY"));
        context.put("assessment", Map.of("assessmentId", p.assessmentId, "name", e.c().name, "examCategory", e.c().category));
        context.put("header", header);
        context.put("courseOutcomes", cos);
        context.put("bloomKeywords", PaperRules.BLOOM_KEYWORDS);
        context.put("subQuestions", subs);
        return Map.of("validationId", p.validationId, "basedOnVersion", p.version, "context", context);
    }

    private void analyse(String assessmentId, Map<String, Object> request) {
        try {
            JsonNode answer = ai.post("/question-paper/validate", request);
            Paper p = stored(assessmentId);
            if (p == null || !"ANALYZING".equals(p.status)) return;
            Offering o = mongo.findById(p.offeringId, Offering.class);
            Result r = score(p, cams.courseOutcomes(o), answer);
            if (r == null) {
                log.warn("AI answer rejected for {}: {}", assessmentId, answer);
                fail(p, "AI_OUTPUT_INVALID", "The AI’s answer didn’t match the paper. Try again.");
                return;
            }
            mongo.save(r);
            p.status = "ANALYSIS_READY";
            p.analysisStartedAt = null;
            p.version++;
            p.updatedAt = Instant.now();
            mongo.save(p);
        } catch (ApiException ex) {
            String code = "UPSTREAM_TIMEOUT".equals(ex.errorCode()) ? "UPSTREAM_TIMEOUT" : "AI_SERVICE_UNAVAILABLE";
            Paper p = stored(assessmentId);
            if (p != null && "ANALYZING".equals(p.status)) fail(p, code, ex.getMessage());
        } catch (RuntimeException ex) {
            log.error("Question paper analysis failed for {}", assessmentId, ex);
            Paper p = stored(assessmentId);
            if (p != null && "ANALYZING".equals(p.status)) fail(p, "AI_SERVICE_UNAVAILABLE", "The analysis failed. Try again.");
        }
    }

    /**
     * Checks the AI's answer (§10.7.5 step 3) and computes the result (step 4). Null when the
     * answer can't be trusted: a missing or extra sub-question, a bad enum, or a bad CO suggestion.
     */
    static Result score(Paper p, List<CamDocs.CourseOutcome> allCos, JsonNode answer) {
        List<Flat> flat = QpDocs.flatten(p.questions);
        Set<String> ticked = new HashSet<>(p.coIds);
        Map<String, JsonNode> byKey = new HashMap<>();
        for (JsonNode a : answer.path("subQuestions")) {
            String k = key(a.path("questionNo").asString(""), a.path("partLabel").isNull() ? null : a.path("partLabel").asString(null), a.path("label").asString(""));
            if (byKey.put(k, a) != null) return null;
        }
        if (byKey.size() != flat.size()) return null;

        Result r = new Result();
        r.assessmentId = p.assessmentId;
        r.validationId = p.validationId;
        r.basedOnVersion = p.version;
        double weighted = 0, totalMarks = 0;
        for (Flat f : flat) {
            JsonNode a = byKey.get(key(f.question().questionNo, f.partLabel(), f.sub().label));
            // The AI service accepts the label repeated as partLabel on a question without parts, but sends it back unchanged.
            if (a == null && f.part() == null) a = byKey.get(key(f.question().questionNo, f.sub().label, f.sub().label));
            if (a == null) return null;
            String coAlignment = a.path("coAlignment").asString("");
            String detected = a.path("detectedBloomLevel").asString("");
            if (!Set.of("ALIGNED", "PARTIAL", "MISALIGNED").contains(coAlignment) || !PaperRules.BLOOM_LEVELS.contains(detected)) return null;
            String suggested = a.path("suggestedCoId").isMissingNode() || a.path("suggestedCoId").isNull() ? null : a.path("suggestedCoId").asString();
            if (suggested != null && (!ticked.contains(suggested) || suggested.equals(f.coId()) || "ALIGNED".equals(coAlignment))) return null;
            boolean mcq = "MCQ".equals(f.sub().type);
            JsonNode mcqNode = a.path("mcqCheck");
            boolean hasMcq = !mcqNode.isMissingNode() && !mcqNode.isNull();
            if (hasMcq && !mcq) return null;

            Validated v = new Validated();
            v.questionNo = f.question().questionNo;
            v.partLabel = f.partLabel();
            v.label = f.sub().label;
            v.coId = f.coId();
            v.coAlignment = coAlignment;
            v.suggestedCoId = suggested;
            v.expectedBloomLevel = f.sub().expectedBloomLevel;
            v.detectedBloomLevel = detected;
            int gap = Math.abs(PaperRules.BLOOM_LEVELS.indexOf(detected) - PaperRules.BLOOM_LEVELS.indexOf(v.expectedBloomLevel));
            v.bloomAlignment = gap == 0 ? "ALIGNED" : gap == 1 ? "PARTIAL" : "MISALIGNED";
            if (hasMcq) {
                v.mcqCheck = new QpDocs.McqCheck();
                v.mcqCheck.status = "ISSUE".equals(mcqNode.path("status").asString("")) ? "ISSUE" : "OK";
                v.mcqCheck.note = mcqNode.path("note").isNull() ? null : mcqNode.path("note").asString(null);
            }
            v.aiAnalysis = a.path("aiAnalysis").asString("");
            List<String> flags = new ArrayList<>();
            for (JsonNode fl : a.path("flags")) flags.add(fl.asString());
            v.flags = flags.isEmpty() ? null : flags;
            // §10.7.5 deductions (ASSUMPTION: the weights are a proposal until the team confirms them).
            int score = 100
                    - (coAlignment.equals("PARTIAL") ? 20 : coAlignment.equals("MISALIGNED") ? 40 : 0)
                    - (v.bloomAlignment.equals("PARTIAL") ? 15 : v.bloomAlignment.equals("MISALIGNED") ? 35 : 0)
                    - (v.mcqCheck != null && "ISSUE".equals(v.mcqCheck.status) ? 15 : 0)
                    - (v.flags != null ? 10 : 0);
            v.validationScore = Math.max(0, score);
            r.subQuestions.add(v);
            weighted += v.validationScore * f.sub().marks;
            totalMarks += f.sub().marks;
        }
        r.overallValidationScore = (int) Math.round(totalMarks > 0 ? weighted / totalMarks : 0);
        for (CamDocs.CourseOutcome c : allCos) {
            if (!ticked.contains(c.coId)) continue;
            QpDocs.CoCoverage cc = new QpDocs.CoCoverage();
            cc.coId = c.coId;
            cc.code = c.code;
            for (Flat f : flat) if (c.coId.equals(f.coId())) { cc.subQuestionCount++; cc.marks += f.sub().marks; }
            r.coCoverage.add(cc);
        }
        for (String level : PaperRules.BLOOM_LEVELS) {
            QpDocs.BloomCount b = new QpDocs.BloomCount();
            b.level = level;
            for (Flat f : flat) if (level.equals(f.sub().expectedBloomLevel)) { b.subQuestionCount++; b.marks += f.sub().marks; }
            r.bloomDistribution.add(b);
        }
        r.summary = answer.path("summary").isNull() ? null : answer.path("summary").asString(null);
        r.modelUsed = answer.path("modelUsed").asString("unknown");
        r.templateId = answer.path("templateId").isNull() ? null : answer.path("templateId").asString(null);
        r.templateVersion = answer.path("templateVersion").isNull() ? null : answer.path("templateVersion").asString(null);
        r.generatedAt = Instant.now();
        return r;
    }

    private static String key(String questionNo, String partLabel, String label) {
        return Objects.toString(questionNo, "").trim() + "|" + Objects.toString(partLabel, "").trim() + "|" + Objects.toString(label, "").trim();
    }

    /* ---------------------------------- helpers ---------------------------------- */

    private Paper stored(String assessmentId) {
        return mongo.findOne(Query.query(Criteria.where("assessmentId").is(assessmentId)), Paper.class);
    }

    private void removeResult(String assessmentId) {
        Result r = mongo.findById(assessmentId, Result.class);
        if (r != null) mongo.remove(r);
    }

    private static void writable(Paper p, Integer version) {
        if ("FINALIZED".equals(p.status)) throw ApiException.conflict("ALREADY_FINALIZED", "The paper is confirmed. Reopen it to make changes.");
        if (version == null || version != p.version) throw ApiException.versionConflict();
    }

    private void fail(Paper p, String code, String message) {
        p.status = "ANALYSIS_FAILED";
        p.error = QpDocs.Error.of(code, message);
        p.analysisStartedAt = null;
        p.version++;
        p.updatedAt = Instant.now();
        mongo.save(p);
    }

    private static void touch(Paper p, Offering o) {
        p.version++;
        p.updatedAt = Instant.now();
        p.updatedBy = o.courseCoordinator != null ? o.courseCoordinator.fullName : "Faculty";
    }

    private PaperView view(Exam e, Paper p) {
        List<CamDocs.CourseOutcome> cos = cams.courseOutcomes(e.o());
        return new PaperView(p.validationId, p.offeringId, p.assessmentId, e.c().name, e.c().category, p.status, p.version,
                p.header, cos, p.coIds, p.questions, PaperRules.paperMarks(p.questions), PaperRules.issues(p, cos), p.error,
                p.finalizedAt, p.updatedAt, p.updatedBy);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
