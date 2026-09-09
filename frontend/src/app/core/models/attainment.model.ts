/**
 * ============================================================================
 *  attainment.model.ts  —  CO / PO Attainment Calculation (Epic 3)
 * ============================================================================
 *  OWNER:
 *   • Abhijeet → all of this is deterministic backend computation in Spring Boot
 *                over CockroachDB (no AI). The frontend sends config + marks and
 *                renders the returned results.
 *
 *  CALCULATION CHAIN:
 *   student question-wise marks → question⇄CO mapping →
 *   CO attainment (% of students meeting the CO target) → CO attainment level →
 *   PO attainment (weighted avg of CO levels via the CO⇄PO correlation matrix).
 *   final = direct% * directWeightage + indirect% * indirectWeightage.
 * ============================================================================
 */
import {
  AttainmentLevel, AuditFields, CoPoCorrelation, ID, IsoDateTime,
} from './common.model';

/** Assessment kinds that feed attainment. */
export type AssessmentType =
  | 'INTERNAL_TEST'
  | 'ASSIGNMENT'
  | 'QUIZ'
  | 'END_SEM'
  | 'LAB'
  | 'INDIRECT_SURVEY';

export type AttainmentReportStatus = 'DRAFT' | 'SUBMITTED_TO_HOD' | 'APPROVED' | 'REVISION_REQUESTED';

/* ----------------------------------------------------------------------------
 *  Configuration (per course)
 *  GET/PUT /courses/{courseId}/attainment/config
 * ------------------------------------------------------------------------- */
export interface AttainmentConfiguration extends Partial<AuditFields> {
  configId: ID;
  courseId: ID;
  /** % a student must score on a CO to "attain" it (e.g. 60). */
  targetPercentage: number;
  /** Direct/indirect split — must sum to 100. */
  directWeightage: number;    // e.g. 80
  indirectWeightage: number;  // e.g. 20
  /**
   * Level thresholds = % of the class that must meet targetPercentage.
   * e.g. level1=40, level2=60, level3=75  →  <40 = level 0.
   */
  level1Threshold: number;
  level2Threshold: number;
  level3Threshold: number;
}

/** An assessment event (a test, quiz, survey…). */
export interface Assessment extends Partial<AuditFields> {
  assessmentId: ID;
  courseId: ID;
  name: string;              // "Internal Test 1"
  type: AssessmentType;
  maxMarks: number;
  conductedOn?: IsoDateTime;
}

/* ----------------------------------------------------------------------------
 *  Student marks upload (direct attainment source)
 *  POST /assessments/{assessmentId}/marks
 *  NOTE: students have NO login — identity lives inside the mark record.
 * ------------------------------------------------------------------------- */
export interface QuestionMark {
  questionId: ID;
  coId: ID;
  marksObtained: number;
  maxMarks: number;
}
export interface StudentMark {
  studentRollNo: string;     // natural identifier, e.g. "2K22-CS-050"
  studentName: string;
  questionMarks: QuestionMark[];
}

/** One entry of the CO⇄PO correlation matrix. */
export interface CoPoMappingEntry {
  coId: ID;
  coCode: string;   // "CO1"
  poCode: string;   // "PO1" | "PSO1"
  correlation: CoPoCorrelation; // 1 | 2 | 3
}

/* ----------------------------------------------------------------------------
 *  Results
 *  POST /courses/{courseId}/attainment/calculate  → AttainmentReport
 * ------------------------------------------------------------------------- */
export interface CoAttainmentResult {
  coId: ID;
  coCode: string;
  targetPercentage: number;
  studentsMeetingTarget: number;
  totalStudents: number;
  /** % of students who met the target (drives the level). */
  attainmentPercentage: number;
  directAttainment: number;    // from assessments
  indirectAttainment: number;  // from surveys
  /** weighted: direct*w1 + indirect*w2. */
  finalAttainment: number;
  attainmentLevel: AttainmentLevel;
  /** true when attainmentLevel < target level → routed to Report Analysis. */
  gapDetected: boolean;
}

export interface PoAttainmentResult {
  poCode: string;
  poDescription: string;
  /** weighted average of contributing CO attainment values. */
  attainmentValue: number;
  attainmentLevel: AttainmentLevel;
  contributingCoCodes: string[];
}

export interface AttainmentReport extends Partial<AuditFields> {
  reportId: ID;
  courseId: ID;
  courseCode: string;
  academicYear: string;
  term: string;
  config: AttainmentConfiguration;
  coResults: CoAttainmentResult[];
  poResults: PoAttainmentResult[];
  overallCoAttainment: number;
  overallPoAttainment: number;
  gapCount: number;
  status: AttainmentReportStatus;
  generatedAt: IsoDateTime;
}

/** Request body for /calculate. */
export interface CalculateAttainmentRequest {
  courseId: ID;
  /** Optional override; if omitted the saved config is used. */
  config?: AttainmentConfiguration;
  assessmentIds?: ID[];
}
