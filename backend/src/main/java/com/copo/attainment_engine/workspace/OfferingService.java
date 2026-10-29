package com.copo.attainment_engine.workspace;

import com.copo.attainment_engine.common.security.CurrentUser;
import com.copo.attainment_engine.common.web.ApiException;
import com.copo.attainment_engine.workspace.Lifecycle.Cycle;
import com.copo.attainment_engine.workspace.Lifecycle.NextAction;
import com.copo.attainment_engine.workspace.Lifecycle.StepState;
import com.copo.attainment_engine.workspace.cam.CamDocs;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * API_CONTRACT §7 (FAC-1 to FAC-4) and §8 (PLAN-1 to PLAN-3), plus the lifecycle moves
 * the CAM, paper and marksheet services make. Only this service changes `progress`.
 */
@Service
public class OfferingService {

    public record OfferingView(String offeringId, Offering.CourseRef course, Offering.Ref academicYear,
                               Offering.SemesterRef semester, String programName, String className, String division,
                               String assessmentScheme, int classStrength, Offering.PersonRef courseCoordinator,
                               Offering.Allocation allocation, boolean readOnly, Lifecycle.Progress progress) {}

    public record Attention(String offeringId, String courseCode, String step, String assessmentId, String label, Instant since) {}

    public record Dashboard(int offeringsCount, List<Attention> attention, List<OfferingView> offerings) {}

    public record PlanUpdate(Integer version, List<PlanUpdateItem> assessments) {}

    public record PlanUpdateItem(String assessmentId, int order, String plannedDate, String activityType) {}

    static final Set<String> ACTIVITY_TYPES = Set.of(
            "ASSIGNMENT", "CRITICAL_PROBLEM", "SEMINAR_PRESENTATION", "CASE_STUDY", "MINI_PROJECT", "REAL_LIFE_PROBLEM");

    private final MongoTemplate mongo;

    public OfferingService(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    /* --------------------------------- reads --------------------------------- */

    /** FAC-1 */
    public List<OfferingView> mine() {
        return mongo.find(Query.query(Criteria.where("facultyUserId").is(CurrentUser.id())), Offering.class).stream()
                .sorted(Comparator.comparing(o -> o.course.courseCode)).map(OfferingService::view).toList();
    }

    /** FAC-3 */
    public Dashboard dashboard() {
        List<OfferingView> offerings = mine();
        List<Attention> attention = offerings.stream().filter(o -> o.progress().nextAction != null)
                .map(o -> new Attention(o.offeringId(), o.course().courseCode, o.progress().nextAction.step,
                        o.progress().nextAction.assessmentId, o.progress().nextAction.label, since(o)))
                .toList();
        return new Dashboard(offerings.size(), attention, offerings);
    }

    /** FAC-2 */
    public OfferingView get(String offeringId) {
        return view(own(offeringId));
    }

    /** The offering, if the signed-in faculty member owns it (403 otherwise, as FAC-2 says). */
    public Offering own(String offeringId) {
        Offering o = mongo.findById(offeringId, Offering.class);
        if (o == null) throw ApiException.notFound("Course not found.");
        if (!Objects.equals(o.facultyUserId, CurrentUser.id())) {
            throw ApiException.forbidden("This course is allocated to another faculty member.");
        }
        return o;
    }

    /** The owned offering that has this assessment in its cycles. */
    public Offering ownByAssessment(String assessmentId) {
        Offering o = mongo.findOne(Query.query(Criteria.where("progress.cycles.assessmentId").is(assessmentId)), Offering.class);
        if (o == null) throw ApiException.notFound("Assessment not found.");
        return own(o.id);
    }

    public static Cycle cycle(Offering o, String assessmentId) {
        return o.progress.cycles.stream().filter(c -> c.assessmentId.equals(assessmentId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Assessment not found."));
    }

    /** Maximum marks of an assessment, as the finalized plan has them. */
    public double plannedMaxMarks(Offering o, String assessmentId) {
        return plan(o).assessments.stream().filter(a -> a.assessmentId.equals(assessmentId)).findFirst()
                .map(a -> a.maxMarks).orElseThrow(() -> ApiException.notFound("Assessment not found."));
    }

    public static OfferingView view(Offering o) {
        return new OfferingView(o.id, o.course, o.academicYear, o.semester, o.programName, o.className, o.division,
                o.assessmentScheme, o.classStrength, o.courseCoordinator, o.allocation, o.readOnly, o.progress);
    }

    private static Instant since(OfferingView o) {
        return o.allocation().acceptedAt != null ? o.allocation().acceptedAt : o.allocation().notifiedAt;
    }

    /* ------------------------------ FAC-4 accept ------------------------------ */

    public OfferingView accept(String offeringId) {
        Offering o = own(offeringId);
        if ("ACCEPTED".equals(o.allocation.status)) throw ApiException.conflict("ALREADY_FINALIZED", "You’ve already accepted this subject.");
        o.allocation.status = "ACCEPTED";
        o.allocation.acceptedAt = Instant.now();
        o.progress.setup.subjectSelection = StepState.done();
        o.progress.setup.assessmentPlan = StepState.available();
        o.progress.nextAction = NextAction.of("ASSESSMENT_PLAN", null, "Check the assessment plan and finalize it");
        return view(mongo.save(o));
    }

    /* ----------------------------- PLAN-1 to PLAN-3 ----------------------------- */

    /** PLAN-1: generated from the load distribution row on first read; readable before acceptance as a preview. */
    public AssessmentPlan plan(String offeringId) {
        return plan(own(offeringId));
    }

    AssessmentPlan plan(Offering o) {
        AssessmentPlan p = mongo.findOne(Query.query(Criteria.where("offeringId").is(o.id)), AssessmentPlan.class);
        return p != null ? p : mongo.save(generatePlan(o));
    }

    /** PLAN-2: only the order, planned dates and activity types change. */
    public AssessmentPlan savePlan(String offeringId, PlanUpdate body) {
        Offering o = own(offeringId);
        AssessmentPlan plan = plan(o);
        requireOpen(o.progress.setup.assessmentPlan);
        if ("FINALIZED".equals(plan.status)) throw ApiException.conflict("ALREADY_FINALIZED", "The assessment plan is finalized.");
        if (body.version() == null || body.version() != plan.version) throw ApiException.versionConflict();
        List<PlanUpdateItem> items = body.assessments() == null ? List.of() : body.assessments();
        String ids = plan.assessments.stream().map(a -> a.assessmentId).sorted().collect(Collectors.joining("|"));
        if (!items.stream().map(PlanUpdateItem::assessmentId).sorted().collect(Collectors.joining("|")).equals(ids)) {
            throw ApiException.validation("Set by the coordinator in the load distribution: assessments can’t be added or removed.", null);
        }
        List<Integer> orders = items.stream().map(PlanUpdateItem::order).sorted().toList();
        for (int i = 0; i < orders.size(); i++) {
            if (orders.get(i) != i + 1) throw ApiException.validation("Each assessment needs its own position, from 1 up.", null);
        }
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        Map<String, AssessmentPlan.Planned> byId = plan.assessments.stream().collect(Collectors.toMap(a -> a.assessmentId, a -> a));
        for (int i = 0; i < items.size(); i++) {
            PlanUpdateItem u = items.get(i);
            AssessmentPlan.Planned a = byId.get(u.assessmentId());
            if (u.activityType() != null && !u.activityType().isBlank()
                    && (!"ACTIVITY".equals(a.category) || !ACTIVITY_TYPES.contains(u.activityType()))) {
                fieldErrors.put("assessments[" + i + "].activityType", "Only activities have a type.");
            }
            if (u.plannedDate() != null && !u.plannedDate().isBlank() && !u.plannedDate().matches("\\d{4}-\\d{2}-\\d{2}")) {
                fieldErrors.put("assessments[" + i + "].plannedDate", "Use a date like 2026-11-20.");
            }
        }
        if (!fieldErrors.isEmpty()) throw ApiException.validation("Check the highlighted assessments.", fieldErrors);

        for (PlanUpdateItem u : items) {
            AssessmentPlan.Planned a = byId.get(u.assessmentId());
            a.order = u.order();
            a.plannedDate = u.plannedDate() == null || u.plannedDate().isBlank() ? null : u.plannedDate();
            if ("ACTIVITY".equals(a.category)) a.activityType = u.activityType() == null || u.activityType().isBlank() ? null : u.activityType();
        }
        plan.assessments.sort(Comparator.comparingInt(a -> a.order));
        plan.issues = planIssues(plan);
        touch(plan, o);
        o.progress.setup.assessmentPlan = StepState.inProgress();
        mongo.save(o);
        return mongo.save(plan);
    }

    /** PLAN-3: fixes the cycles in plan order and opens the CAM, pre-filled from the syllabus and the department's outcomes. */
    public AssessmentPlan finalizePlan(String offeringId, Integer version) {
        Offering o = own(offeringId);
        AssessmentPlan plan = plan(o);
        requireOpen(o.progress.setup.assessmentPlan);
        if ("FINALIZED".equals(plan.status)) throw ApiException.conflict("ALREADY_FINALIZED", "The assessment plan is already finalized.");
        if (version == null || version != plan.version) throw ApiException.versionConflict();
        if (!plan.issues.isEmpty()) throw ApiException.precondition(plan.issues.getFirst().message);

        plan.status = "FINALIZED";
        touch(plan, o);
        o.progress.setup.assessmentPlan = StepState.done();
        o.progress.setup.cam = StepState.available();
        o.progress.cycles = plan.assessments.stream()
                .map(a -> Lifecycle.lockedCycle(a.assessmentId, a.name, a.category, a.order, "Finalize the CAM first"))
                .collect(Collectors.toCollection(ArrayList::new));
        o.progress.nextAction = NextAction.of("CAM", null, "Build the course articulation matrix");
        mongo.save(newCam(o, plan));
        mongo.save(o);
        return mongo.save(plan);
    }

    private static void touch(AssessmentPlan plan, Offering o) {
        plan.version++;
        plan.updatedAt = Instant.now();
        plan.updatedBy = o.courseCoordinator != null ? o.courseCoordinator.fullName : "Faculty";
    }

    /* ------------------------- lifecycle moves (§7.1) ------------------------- */

    /** The first CAM save. */
    public void camStarted(Offering o) {
        if (o.progress.setup.cam.is("AVAILABLE")) {
            o.progress.setup.cam = StepState.inProgress();
            mongo.save(o);
        }
    }

    /** CAM-3: setup is done and the first assessment cycle opens. */
    public void camFinalized(Offering o) {
        o.progress.setup.cam = StepState.done();
        o.progress.phase = "ASSESSMENTS";
        List<Cycle> cycles = o.progress.cycles;
        o.progress.nextAction = Lifecycle.open(cycles.getFirst());
        for (Cycle later : cycles.subList(1, cycles.size())) {
            Cycle locked = Lifecycle.lockedCycle(later.assessmentId, later.name, later.category, later.order,
                    "Waiting for " + cycles.getFirst().name + " attainment approval");
            later.steps = locked.steps;
        }
        mongo.save(o);
    }

    /** QPV-2: the first save of a paper. */
    public void paperStarted(Offering o, String assessmentId) {
        Cycle c = cycle(o, assessmentId);
        if (c.steps.paperValidation.is("AVAILABLE")) {
            c.steps.paperValidation = StepState.inProgress();
            mongo.save(o);
        }
    }

    /** QPV-6: paper validation is done and the cycle's read-only marksheet opens. */
    public void paperConfirmed(Offering o, String assessmentId) {
        Cycle c = cycle(o, assessmentId);
        c.steps.paperValidation = StepState.done();
        c.steps.marksheet = StepState.available();
        o.progress.nextAction = NextAction.of("MARKSHEET", assessmentId, "Check and finalize the " + c.name + " marksheet");
        mongo.save(o);
    }

    /** QPV-8: back to paper validation. */
    public void paperReopened(Offering o, String assessmentId) {
        Cycle c = cycle(o, assessmentId);
        c.steps.paperValidation = StepState.inProgress();
        c.steps.marksheet = StepState.locked("Confirm the question paper first");
        o.progress.nextAction = NextAction.of("PAPER_VALIDATION", assessmentId, "Confirm the " + c.name + " question paper");
        mongo.save(o);
    }

    /** MS-3: the block's columns are in the workbook; marks entry opens. */
    public void marksheetFinalized(Offering o, String assessmentId) {
        Cycle c = cycle(o, assessmentId);
        c.steps.marksheet = StepState.done();
        c.steps.marksEntry = StepState.available();
        o.progress.nextAction = NextAction.of("MARKS_ENTRY", assessmentId, "Enter and submit the " + c.name + " marks");
        mongo.save(o);
    }

    /** 409 STAGE_LOCKED with the step's reason (§7.1). */
    public static void requireOpen(StepState step) {
        if (step == null || step.is("LOCKED")) {
            throw ApiException.conflict("STAGE_LOCKED", step != null && step.lockedReason != null ? step.lockedReason : "This step is locked.");
        }
    }

    /* ---------------------------- plan generation ---------------------------- */

    /**
     * One assessment per item counted in the load distribution row, with its marks (§8).
     * The default order alternates ISE tests and activities, then practicals and
     * tutorials, then the ESE and OE/POE.
     */
    static AssessmentPlan generatePlan(Offering o) {
        Map<String, Integer> counts = new HashMap<>();
        for (Offering.ComponentItem it : o.components) counts.merge(it.category, it.count, Integer::sum);
        Map<String, Integer> seq = new HashMap<>();
        List<AssessmentPlan.Planned> all = new ArrayList<>();
        for (Offering.ComponentItem it : o.components) {
            for (int n = 0; n < it.count; n++) {
                int s = seq.merge(it.category, 1, Integer::sum);
                AssessmentPlan.Planned a = new AssessmentPlan.Planned();
                a.assessmentId = "as-" + o.id + "-" + it.category.toLowerCase().replace("_", "") + "-" + s;
                a.category = it.category;
                a.phase = "ESE".equals(it.component) || "OE_POE".equals(it.component) ? "ESE" : "ISE";
                a.componentType = componentType(it);
                a.name = assessmentName(it.category, s, counts.get(it.category));
                a.sequence = s;
                a.maxMarks = it.maxMarksEach;
                all.add(a);
            }
        }
        List<AssessmentPlan.Planned> tests = ofCategory(all, "ISE");
        List<AssessmentPlan.Planned> acts = ofCategory(all, "ACTIVITY");
        List<AssessmentPlan.Planned> ordered = new ArrayList<>();
        for (int i = 0; i < Math.max(tests.size(), acts.size()); i++) {
            if (i < tests.size()) ordered.add(tests.get(i));
            if (i < acts.size()) ordered.add(acts.get(i));
        }
        for (String c : List.of("PRACTICAL", "TUTORIAL", "ESE", "POE", "OE", "OE_POE")) ordered.addAll(ofCategory(all, c));
        for (int i = 0; i < ordered.size(); i++) ordered.get(i).order = i + 1;

        AssessmentPlan plan = new AssessmentPlan();
        plan.planId = "plan-" + o.id;
        plan.offeringId = o.id;
        Map<String, AssessmentPlan.SchemeComponent> scheme = new LinkedHashMap<>();
        for (Offering.ComponentItem it : o.components) {
            AssessmentPlan.SchemeComponent sc = scheme.computeIfAbsent(it.component, k -> {
                AssessmentPlan.SchemeComponent x = new AssessmentPlan.SchemeComponent();
                x.type = componentType(it);
                return x;
            });
            sc.maxMarks += it.count * it.maxMarksEach;
        }
        plan.examinationScheme.components = new ArrayList<>(scheme.values());
        plan.assessments = ordered;
        plan.issues = planIssues(plan);
        plan.updatedAt = Instant.now();
        plan.updatedBy = "The coordinator’s load distribution";
        return plan;
    }

    private static List<AssessmentPlan.Planned> ofCategory(List<AssessmentPlan.Planned> all, String category) {
        return all.stream().filter(a -> a.category.equals(category)).toList();
    }

    private static String componentType(Offering.ComponentItem it) {
        return switch (it.component) {
            case "ESE" -> "ESE";
            case "ISE" -> "ISE";
            case "ICA" -> "ICA";
            default -> it.category;   // OE / POE / OE_POE
        };
    }

    private static String assessmentName(String category, int seq, int count) {
        return switch (category) {
            case "ISE" -> "ISE-" + seq;
            case "ACTIVITY" -> "Activity " + seq;
            case "PRACTICAL" -> "Practical " + seq;
            case "TUTORIAL" -> "Tutorial " + seq;
            case "ESE" -> count > 1 ? "ESE " + seq : "ESE";
            case "OE_POE" -> "OE/POE";
            default -> count > 1 ? category + " " + seq : category;
        };
    }

    static List<AssessmentPlan.Issue> planIssues(AssessmentPlan plan) {
        return plan.assessments.stream().filter(a -> "ACTIVITY".equals(a.category) && a.activityType == null).map(a -> {
            AssessmentPlan.Issue i = new AssessmentPlan.Issue();
            i.code = "ACTIVITY_TYPE_MISSING";
            i.message = "Choose the type of " + a.name + ".";
            i.assessmentId = a.assessmentId;
            return i;
        }).collect(Collectors.toCollection(ArrayList::new));
    }

    /** The draft CAM: syllabus inputs and the department's outcomes pre-filled, one item per planned activity/practical/tutorial. */
    private static CamDocs.Cam newCam(Offering o, AssessmentPlan plan) {
        CamDocs.Cam cam = new CamDocs.Cam();
        cam.camId = "cam-" + o.id;
        cam.offeringId = o.id;
        cam.inputs.courseObjectives = new ArrayList<>(o.courseObjectives);
        cam.inputs.courseOutcomes = new ArrayList<>(o.courseOutcomes);
        cam.inputs.units = new ArrayList<>(o.units);
        cam.inputs.programOutcomes = new ArrayList<>(o.programOutcomes);
        cam.inputs.activities = items(plan, "ACTIVITY");
        cam.inputs.practicals = items(plan, "PRACTICAL");
        cam.inputs.tutorials = items(plan, "TUTORIAL");
        cam.updatedAt = Instant.now();
        cam.updatedBy = o.courseCoordinator != null ? o.courseCoordinator.fullName : "Faculty";
        return cam;
    }

    private static List<CamDocs.Item> items(AssessmentPlan plan, String category) {
        return plan.assessments.stream().filter(a -> a.category.equals(category))
                .sorted(Comparator.comparingInt(a -> a.sequence)).map(a -> {
                    CamDocs.Item i = new CamDocs.Item();
                    i.itemId = "item-" + a.assessmentId;
                    i.title = a.name;
                    return i;
                }).collect(Collectors.toCollection(ArrayList::new));
    }
}
