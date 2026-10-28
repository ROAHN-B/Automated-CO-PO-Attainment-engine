/**
 * ============================================================================
 *  marksheet.model.ts  —  API_CONTRACT.md v2.7 §12 (marksheet structure)
 * ============================================================================
 *  For ISE and ESE theory papers the structure is generated from the confirmed
 *  question paper and is read-only (source QUESTION_PAPER). Finalizing it fills
 *  the assessment's columns in the course workbook and opens marks entry.
 * ============================================================================
 */
import { ID } from './common.model';
import { AttemptRule, QpBloomLevel } from './question-paper.model';

export interface StructureSubQuestion {
  label: string;                 // "(a)(i)"
  coIds: ID[];                   // 1 or 2 COs
  maxMarks: number;
  bloomLevel?: QpBloomLevel;
}

export interface StructureQuestion {
  questionNo: string;            // "Q1"
  /** Either sub-questions OR (coIds + maxMarks) on the question itself. */
  subQuestions?: StructureSubQuestion[];
  coIds?: ID[];
  appliesToAllCos?: boolean;
  maxMarks?: number;
  bloomLevel?: QpBloomLevel;
  attemptRule?: AttemptRule;
}

export interface AssessmentStructure {
  assessmentId: ID;
  offeringId: ID;
  assessmentName: string;
  plannedMaxMarks: number;
  status: 'DRAFT' | 'FINALIZED';
  /** QUESTION_PAPER: generated from the confirmed paper, read-only. FACULTY: typed by the faculty. */
  source: 'QUESTION_PAPER' | 'FACULTY';
  version: number;
  questions: StructureQuestion[];
  attemptRule?: AttemptRule;
  /** Backend-computed, attempt rules applied. Display only. */
  computedMaxMarks?: number;
  issues: { code: string; message: string; path?: string }[];
  /** The course's COs, so the screen can show codes for `coIds`. */
  courseOutcomes: { coId: ID; code: string; statement: string }[];
}
