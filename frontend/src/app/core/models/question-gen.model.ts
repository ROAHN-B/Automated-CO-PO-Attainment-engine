/**
 * ============================================================================
 *  question-gen.model.ts  —  AI Question Paper Generation (RAG)
 * ============================================================================
 *  OWNERS:
 *   • Mayuri  → RAG generation endpoint: retrieves chunks from the unit's vector
 *               store and prompts the LLM to produce CO/Bloom-tagged questions.
 *   • Abhijeet→ persists generated questions, review decisions & question papers;
 *               renders the final PDF (Apache PDFBox).
 *
 *  FLOW (wizard, no file upload — the unit is already embedded):
 *   select unit → configure mark distribution → map COs → generate (LLM) →
 *   review/select questions → assemble & download PDF.
 * ============================================================================
 */
import { AuditFields, BloomLevel, ID, IsoDateTime } from './common.model';

/** Review state of a single AI-generated question. */
export type QuestionReviewStatus =
  | 'GENERATED'  // fresh from the LLM, awaiting review
  | 'ACCEPTED'   // faculty kept it as-is
  | 'EDITED'     // faculty modified the text
  | 'REJECTED';  // faculty discarded it

/**
 * The format a blueprint row asks the LLM to produce.
 *   • MCQ               → objective, comes with `options` (+ answer key)
 *   • FILL_IN_THE_BLANK → cloze / one-word, blank marked with "____"
 *   • SHORT_ANSWER      → a few lines
 *   • LONG_ANSWER       → descriptive / essay
 */
export type QuestionType =
  | 'MCQ'
  | 'FILL_IN_THE_BLANK'
  | 'SHORT_ANSWER'
  | 'LONG_ANSWER';

/** Iteration order for dropdowns. */
export const QUESTION_TYPES: readonly QuestionType[] = [
  'MCQ',
  'FILL_IN_THE_BLANK',
  'SHORT_ANSWER',
  'LONG_ANSWER',
] as const;

/** Human labels for the UI (keys match the enum exactly). */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: 'Multiple choice',
  FILL_IN_THE_BLANK: 'Fill in the blank',
  SHORT_ANSWER: 'Short answer',
  LONG_ANSWER: 'Long answer',
};

/**
 * One row of the exam blueprint: how many questions of a given weight AND of a
 * given format to generate, e.g. { marks: 2, count: 5, questionType: 'MCQ' }.
 * (Formerly `MarkDistribution` — now carries the per-row question type.)
 */
export interface BlueprintRow {
  marks: number;              // 1, 2, 4, 6, 10 ...
  count: number;              // how many questions of this weight to generate
  questionType: QuestionType; // the format the LLM must produce for this row
}

/* ----------------------------------------------------------------------------
 *  Request → Mayuri's RAG endpoint
 *  POST /generation/questions
 * ------------------------------------------------------------------------- */
export interface QuestionGenerationRequest {
  courseId: ID;
  /** Must reference a unit whose SyllabusUnit.isEmbedded === true. */
  unitId: ID;
  /** COs the generated questions should assess. */
  coIds: ID[];
  /** The exam blueprint — one row per (marks × question type). */
  blueprint: BlueprintRow[];
  /** Optional hard filter on cognitive levels. */
  bloomLevels?: BloomLevel[];
  /** Free-text steering for the LLM (tone, topic emphasis, constraints). */
  additionalInstructions?: string;
}

/** One answer choice for an MCQ. `isCorrect` is the answer key (Abhijeet hides it in the student paper). */
export interface QuestionOption {
  key: string;          // "A", "B", "C", "D"
  text: string;
  isCorrect?: boolean;
}

/** A single question produced by the LLM (pre-persistence, has a temp id). */
export interface GeneratedQuestion {
  questionId: ID;              // temporary id until the paper is saved
  questionText: string;
  marks: number;
  /** Format this question was generated in — mirrors its blueprint row. */
  questionType: QuestionType;
  /** Answer choices — present only when questionType === 'MCQ'. */
  options?: QuestionOption[];
  coId: ID;
  coCode: string;              // denormalised for display, e.g. "CO2"
  bloomLevel: BloomLevel;

  /* ---- RAG provenance (Mayuri) ---- */
  /** Chunk ids the answer was grounded in (traceability). */
  sourceChunkIds?: ID[];
  /** Model confidence 0..1, if available. */
  confidenceScore?: number;

  /* ---- Review state (UI) ---- */
  status: QuestionReviewStatus;
  /** Checkbox state in the review step — kept questions go into the paper. */
  selected: boolean;
}

/**
 * Response from the generation call.
 * The UI shows `questions` in the review step.
 */
export interface QuestionGenerationResponse {
  generationId: ID;
  courseId: ID;
  unitId: ID;
  modelUsed: string;           // e.g. "gemini-2.5-pro"
  requestedAt: IsoDateTime;
  completedAt: IsoDateTime;
  questions: GeneratedQuestion[];
}

/* ----------------------------------------------------------------------------
 *  Assemble + export paper
 *  POST /papers   (returns QuestionPaper incl. pdfUrl / pdf bytes)
 * ------------------------------------------------------------------------- */
export interface QuestionPaperRequest {
  generationId: ID;
  courseId: ID;
  title: string;               // "Unit Test 2 — Data Structures"
  /** questionIds (from GeneratedQuestion) the faculty chose to keep. */
  selectedQuestionIds: ID[];
  examName?: string;
  durationMinutes?: number;
  instructions?: string;
}

export interface QuestionPaper extends Partial<AuditFields> {
  paperId: ID;
  title: string;
  courseId: ID;
  courseCode: string;
  questions: GeneratedQuestion[];
  totalMarks: number;
  totalQuestions: number;
  createdAt: IsoDateTime;
  /** Backend-hosted PDF URL (Abhijeet). Absent while still rendering. */
  pdfUrl?: string;
}
