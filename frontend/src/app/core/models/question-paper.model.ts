/**
 * ============================================================================
 *  question-paper.model.ts  —  API_CONTRACT.md v2.7 §10 (question paper validation)
 * ============================================================================
 *  The faculty types the paper: header, the CAM COs it covers, questions →
 *  optional parts → sub-questions. The CO is set per question or part; the
 *  expected Bloom level per sub-question. Scores, alignments and detected
 *  Bloom levels come from the backend/AI only (AGENTS.md › QUESTION PAPER VALIDATION).
 * ============================================================================
 */
import { ID, IsoDateTime } from './common.model';

export type QpBloomLevel = 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';

export const QP_BLOOM_LEVELS: QpBloomLevel[] = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'];

export const QP_BLOOM_LABEL: Record<QpBloomLevel, string> = {
  REMEMBER: 'Remember', UNDERSTAND: 'Understand', APPLY: 'Apply',
  ANALYZE: 'Analyze', EVALUATE: 'Evaluate', CREATE: 'Create',
};

export type ExamCategory = 'ISE' | 'ESE';
export type QpPaperStatus = 'DRAFT' | 'ANALYZING' | 'ANALYSIS_FAILED' | 'ANALYSIS_READY' | 'FINALIZED';

/** QPV-5: the college's moderation sheet comes as Word or PDF. */
export type QpSheetFormat = 'DOCX' | 'PDF';

export interface AttemptRule {
  attempt: number;
  outOf: number;
}

export interface QpPaperHeader {
  setLabel?: string;
  maxMarks: number;
  durationMinutes?: number;
  examDate?: string;
}

export interface QpOption {
  key: string;
  text: string;
}

export interface QpSubQuestion {
  label: string;
  text: string;
  type: 'DESCRIPTIVE' | 'MCQ';
  options?: QpOption[];
  marks: number;
  expectedBloomLevel: QpBloomLevel;
}

export interface QpPart {
  label: string;
  coId: ID;
  subQuestions: QpSubQuestion[];
}

export interface QpQuestion {
  questionNo: string;
  heading?: string;
  attemptRule?: AttemptRule;
  coId?: ID;
  parts?: QpPart[];
  subQuestions?: QpSubQuestion[];
}

export type QpIssueCode =
  | 'TOTAL_MISMATCH' | 'NO_QUESTIONS' | 'MISSING_CO' | 'CO_NOT_SELECTED' | 'MISSING_TEXT'
  | 'INVALID_MARKS' | 'MCQ_OPTIONS' | 'DUPLICATE_LABEL' | 'ATTEMPT_RULE';

export interface QpIssue {
  code: QpIssueCode;
  message: string;
  path?: string;
}

export interface QpCourseOutcome {
  coId: ID;
  code: string;
  statement: string;
}

export interface QpPaper {
  validationId: ID;
  offeringId: ID;
  assessmentId: ID;
  assessmentName: string;
  examCategory: ExamCategory;
  status: QpPaperStatus;
  version: number;
  header: QpPaperHeader;
  courseOutcomes: QpCourseOutcome[];
  coIds: ID[];
  questions: QpQuestion[];
  computedTotalMarks: number;
  issues: QpIssue[];
  error?: { errorCode: string; message: string };
  /** When the faculty confirmed the paper (QPV-6). */
  finalizedAt?: IsoDateTime;
  updatedAt: IsoDateTime;
  updatedBy: string;
}

export interface QpPaperUpdate {
  version: number;
  header: QpPaperHeader;
  coIds: ID[];
  questions: QpQuestion[];
}

export type QpAlignment = 'ALIGNED' | 'PARTIAL' | 'MISALIGNED';

export interface ValidatedSubQuestion {
  questionNo: string;
  partLabel?: string;
  label: string;
  coId: ID;
  coAlignment: QpAlignment;
  suggestedCoId?: ID;
  expectedBloomLevel: QpBloomLevel;
  detectedBloomLevel: QpBloomLevel;
  bloomAlignment: QpAlignment;
  mcqCheck?: { status: 'OK' | 'ISSUE'; note?: string };
  aiAnalysis: string;
  validationScore: number;
  flags?: string[];
}

export interface QpValidationResult {
  validationId: ID;
  basedOnVersion: number;
  overallValidationScore: number;
  summary?: string;
  subQuestions: ValidatedSubQuestion[];
  coCoverage: { coId: ID; code: string; subQuestionCount: number; marks: number }[];
  bloomDistribution: { level: QpBloomLevel; subQuestionCount: number; marks: number }[];
  modelUsed: string;
  templateId?: string;
  templateVersion?: string;
  generatedAt: IsoDateTime;
}


/* --------------------------------------------------------------------------
 *  Presentation helpers. The UI may preview totals with these; the backend's
 *  `computedTotalMarks` and `issues` are what count (§10.5).
 * ------------------------------------------------------------------------ */

/** A question's sub-questions in paper order, with the part they sit in. */
export function qpSubQuestionsOf(q: QpQuestion): { part?: QpPart; sub: QpSubQuestion }[] {
  return q.parts?.length
    ? q.parts.flatMap(part => part.subQuestions.map(sub => ({ part, sub })))
    : (q.subQuestions ?? []).map(sub => ({ sub }));
}

/** Marks a question carries: with an attempt rule, its highest `attempt` sub-questions. */
export function qpQuestionMarks(q: QpQuestion): number {
  const marks = qpSubQuestionsOf(q).map(x => Number(x.sub.marks) || 0).sort((a, b) => b - a);
  const counted = q.attemptRule && q.attemptRule.attempt > 0 ? marks.slice(0, q.attemptRule.attempt) : marks;
  return counted.reduce((a, b) => a + b, 0);
}

export function qpPaperMarks(questions: QpQuestion[]): number {
  return questions.reduce((a, q) => a + qpQuestionMarks(q), 0);
}
