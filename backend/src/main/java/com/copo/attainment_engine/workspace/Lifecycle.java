package com.copo.attainment_engine.workspace;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * The strictly ordered course lifecycle of API_CONTRACT §7.1 / §7.3. These are the
 * stored shapes and, field for field, the JSON the frontend reads; the backend
 * alone moves them (409 STAGE_LOCKED otherwise).
 */
public final class Lifecycle {

    private Lifecycle() {}

    public static class StepState {
        public String status;           // LOCKED | AVAILABLE | IN_PROGRESS | DONE
        public String lockedReason;
        public Instant updatedAt;

        public static StepState done() { return of("DONE", null); }
        public static StepState available() { return of("AVAILABLE", null); }
        public static StepState inProgress() { return of("IN_PROGRESS", null); }
        public static StepState locked(String reason) { return of("LOCKED", reason); }

        private static StepState of(String status, String reason) {
            StepState s = new StepState();
            s.status = status;
            s.lockedReason = reason;
            s.updatedAt = "LOCKED".equals(status) ? null : Instant.now();
            return s;
        }

        public boolean is(String status) { return status.equals(this.status); }
    }

    public static class CycleSteps {
        /** ISE and ESE theory papers only. */
        public StepState paperValidation;
        public StepState marksheet;
        public StepState marksEntry;
        public StepState attainmentApproval;
    }

    public static class Cycle {
        public String assessmentId;
        public String name;
        public String category;
        public int order;
        public boolean requiresPaperValidation;
        public CycleSteps steps = new CycleSteps();
    }

    public static class Setup {
        public StepState subjectSelection;
        public StepState assessmentPlan;
        public StepState cam;
    }

    public static class CloseOut {
        public StepState indirectSurveys;
        public StepState finalAttainment;
        public StepState submission;
    }

    public static class NextAction {
        public String step;
        public String assessmentId;
        public String label;

        public static NextAction of(String step, String assessmentId, String label) {
            NextAction a = new NextAction();
            a.step = step;
            a.assessmentId = assessmentId;
            a.label = label;
            return a;
        }
    }

    public static class Progress {
        public String phase = "SETUP";  // SETUP | ASSESSMENTS | CLOSE_OUT | SUBMITTED
        public Setup setup = new Setup();
        public List<Cycle> cycles = new ArrayList<>();
        public CloseOut closeOut = new CloseOut();
        public NextAction nextAction;
    }

    /** A cycle whose every step is locked, e.g. until the CAM is finalized. */
    public static Cycle lockedCycle(String assessmentId, String name, String category, int order, String reason) {
        Cycle c = new Cycle();
        c.assessmentId = assessmentId;
        c.name = name;
        c.category = category;
        c.order = order;
        c.requiresPaperValidation = "ISE".equals(category) || "ESE".equals(category);
        if (c.requiresPaperValidation) c.steps.paperValidation = StepState.locked(reason);
        c.steps.marksheet = StepState.locked(reason);
        c.steps.marksEntry = StepState.locked(reason);
        c.steps.attainmentApproval = StepState.locked(reason);
        return c;
    }

    /** Opens a cycle at its first step: the paper for exams, else the marksheet. */
    public static NextAction open(Cycle c) {
        String waiting = "Waiting for the previous step";
        if (c.requiresPaperValidation) {
            c.steps.paperValidation = StepState.available();
            c.steps.marksheet = StepState.locked("Confirm the question paper first");
        } else {
            c.steps.marksheet = StepState.available();
        }
        c.steps.marksEntry = StepState.locked(waiting);
        c.steps.attainmentApproval = StepState.locked(waiting);
        return c.requiresPaperValidation
                ? NextAction.of("PAPER_VALIDATION", c.assessmentId, "Validate the " + c.name + " question paper")
                : NextAction.of("MARKSHEET", c.assessmentId, "Create the " + c.name + " marksheet");
    }
}
