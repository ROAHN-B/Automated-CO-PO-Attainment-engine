/**
 * ============================================================================
 *  faculty-workspace.model.ts  —  API_CONTRACT.md v2.5 §7, §14
 * ============================================================================
 *  Faculty course lifecycle (strictly ordered, server-enforced locks), cumulative
 *  CO-PO attainment runs with their calculation trace, and the live course
 *  workbook. Every number here is produced by the backend — the frontend only
 *  displays it (AGENTS.md › ATTAINMENT FORMULA).
 * ============================================================================
 */
import { AttainmentLevel, ID, IsoDateTime } from './common.model';

/* ------------------------------- shared ---------------------------------- */

export type AssessmentScheme = 'THEORY' | 'PRACTICAL';
export type AssessmentCategory =
  | 'ISE' | 'ACTIVITY' | 'PRACTICAL' | 'TUTORIAL' | 'ESE' | 'POE' | 'OE' | 'OE_POE';
export type OutcomeKind = 'PO' | 'PSO';
export type CorrelationLevel = 1 | 2 | 3;
export type Phase = 'ISE' | 'ESE';

export interface CourseRef {
  syllabusCourseId: ID;
  courseCode: string;
  courseName: string;
}

/* --------------------------- §7 lifecycle -------------------------------- */

export type StepStatus = 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'DONE';

export interface StepState {
  status: StepStatus;
  lockedReason?: string;
  updatedAt?: IsoDateTime;
}

export type StepKey =
  | 'SUBJECT_SELECTION' | 'ASSESSMENT_PLAN' | 'CAM'
  | 'PAPER_VALIDATION' | 'MARKSHEET' | 'MARKS_ENTRY' | 'ATTAINMENT_APPROVAL'
  | 'INDIRECT_SURVEYS' | 'FINAL_ATTAINMENT' | 'SUBMISSION';

export interface AssessmentCycle {
  assessmentId: ID;
  name: string;
  category: AssessmentCategory;
  order: number;
  requiresPaperValidation: boolean;
  steps: {
    paperValidation?: StepState;
    marksheet: StepState;
    /** The faculty imports or types the marks, then submits them (§13). */
    marksEntry: StepState;
    attainmentApproval: StepState;
  };
}

export interface OfferingProgress {
  phase: 'SETUP' | 'ASSESSMENTS' | 'CLOSE_OUT' | 'SUBMITTED';
  setup: { subjectSelection: StepState; assessmentPlan: StepState; cam: StepState };
  cycles: AssessmentCycle[];
  closeOut: { indirectSurveys: StepState; finalAttainment: StepState; submission: StepState };
  nextAction?: {
    step: StepKey;
    assessmentId?: ID;
    label: string;
  };
}

export interface FacultyOffering {
  offeringId: ID;
  course: CourseRef;
  academicYear: { academicYearId: ID; name: string };
  semester: { semesterId: ID; semesterNumber: number };
  programName?: string;
  className?: string;
  division?: string;
  assessmentScheme: AssessmentScheme;
  classStrength: number;
  courseCoordinator?: { userId: ID; fullName: string };
  readOnly: boolean;
  progress: OfferingProgress;
}

export interface AttentionItem {
  offeringId: ID;
  courseCode: string;
  step: StepKey;
  assessmentId?: ID;
  label: string;
  since: IsoDateTime;
}

export interface FacultyDashboard {
  offeringsCount: number;
  attention: AttentionItem[];
  offerings: FacultyOffering[];
}

/* ------------------------- §15.3 targets --------------------------------- */

export interface PhaseCriteria {
  weight: number;
  targetMarksPct: number;
  levelPct: { l1: number; l2: number; l3: number };
}

export interface AttainmentTargetConfig {
  configId: ID;
  version: number;
  ise: PhaseCriteria;
  ese: { theory: PhaseCriteria; practical: PhaseCriteria };
  directWeight: number;
  indirectWeight: number;
  updatedBy: string;
  updatedAt: IsoDateTime;
}

/* --------------------------- §14 attainment ------------------------------ */

export type PendingReason = 'AWAITING_ESE' | 'AWAITING_INDIRECT' | 'NO_DATA';
export type AttainmentRunStatus = 'RUNNING' | 'CALCULATED' | 'APPROVED' | 'DISCARDED' | 'FAILED';

export interface AttainmentScope {
  upToAssessmentId: ID;
  label: string;
  includedAssessments: { assessmentId: ID; name: string; phase: Phase }[];
  isFinal: boolean;
}

export interface ReadinessCheck {
  code: string;
  satisfied: boolean;
  severity: 'BLOCKING' | 'WARNING';
  detail?: string;
}

export interface AttainmentReadiness {
  ready: boolean;
  scope: AttainmentScope;
  inputs: {
    classStrength: number;
    targets: AttainmentTargetConfig;
    coMaxMarks: { coId: ID; coCode: string; ise: number; ese: number | null }[];
  };
  checks: ReadinessCheck[];
}

export interface PhaseAttainment {
  maxMarks: number;
  targetMarksPct: number;
  targetMarks: number;
  studentsAboveTarget: number;
  classStrength: number;
  percentAboveTarget: number;
  levelPct: { l1: number; l2: number; l3: number };
  level: AttainmentLevel;
}

export interface CoAttainmentResult {
  coId: ID;
  code: string;
  statement: string;
  ise: PhaseAttainment;
  ese: PhaseAttainment | null;
  direct: number | null;
  indirect: {
    courseExitSurvey?: number;
    examinerSurvey?: number;
    additionalSurvey?: number;
    value: number | null;
  };
  overall: number | null;
  pendingReason?: PendingReason;
}

export interface OutcomeAttainmentResult {
  outcomeId: ID;
  kind: OutcomeKind;
  code: string;
  statement: string;
  contributions: { coCode: string; correlation: CorrelationLevel; coOverall: number | null; product: number | null }[];
  sumOfProducts: number | null;
  sumOfCorrelations: number;
  attainment: number | null;
  averageCorrelation: number | null;
  courseMapping: CorrelationLevel | null;
  pendingReason?: PendingReason;
}

export interface AttainmentRun {
  runId: ID;
  offeringId: ID;
  course: CourseRef;
  academicYear: string;
  assessmentScheme: AssessmentScheme;
  classStrength: number;
  scope: AttainmentScope;
  version: number;
  status: AttainmentRunStatus;
  reviewStatus: 'NOT_SUBMITTED' | 'SUBMITTED_TO_HOD' | 'APPROVED' | 'REVISION_REQUESTED';
  targets: AttainmentTargetConfig;
  coResults: CoAttainmentResult[];
  outcomeResults: OutcomeAttainmentResult[];
  excludedCoCodes: string[];
  generatedAt?: IsoDateTime;
  generatedBy: string;
  approvedAt?: IsoDateTime;
  approvedBy?: string;
}

export interface StudentCoScore {
  rollNumber: string;
  studentName?: string;
  ise: { obtained: number; max: number; aboveTarget: boolean };
  ese: { obtained: number; max: number; aboveTarget: boolean } | null;
  absent: boolean;
}

/* --------------------------- §14.4 workbook ------------------------------ */

export type WorkbookBlockStatus =
  | 'AWAITING_MARKSHEET' | 'AWAITING_MARKS' | 'FILLED' | 'LOCKED';

export interface WorkbookBlock {
  assessmentId: ID;
  name: string;
  category: AssessmentCategory;
  phase: Phase;
  status: WorkbookBlockStatus;
  questions: { label: string; maxMarks: number; coCodes: string[]; appliesToAllCos: boolean }[];
  canCalculate: boolean;
  attainmentApprovedRunId?: ID;
}

export interface CourseWorkbook {
  offeringId: ID;
  template: AssessmentScheme;
  asOf?: string;
  main: {
    header: { label: string; value: string | null; pendingReason?: string }[];
    criteria: AttainmentTargetConfig;
    coSummary: { coCode: string; statement: string; overall: number | null; pendingReason?: string }[];
  };
  poPso: {
    outcomes: { code: string; kind: OutcomeKind; shortName: string }[];
    matrix: { coCode: string; coOverall: number | null; correlations: Record<string, CorrelationLevel | null> }[];
    average: Record<string, number | null>;
    courseMapping: Record<string, CorrelationLevel | null>;
    attainment: Record<string, number | null>;
  };
  data: { blocks: WorkbookBlock[]; studentCount: number };
}

export interface WorkbookStudentRow {
  serial: number;
  rollNumber: string;
  studentName?: string;
  marks: Record<ID, Record<string, number | 'AB' | null>>;
}
