/**
 * ============================================================================
 *  common.model.ts  —  Shared primitives & domain enums
 * ============================================================================
 *  CONTRACT-FIRST NOTE (read me):
 *  These interfaces are the single source of truth for the whole team.
 *   • Abhijeet  → mirror these as Spring Boot DTOs + CockroachDB (SQL) tables.
 *   • Mayuri    → the RAG/LLM endpoints must accept/return these exact shapes.
 *
 *  Conventions:
 *   • All IDs are strings (CockroachDB UUID / STRING primary keys).
 *   • All timestamps are ISO-8601 strings in UTC (e.g. "2026-08-23T09:30:00Z").
 *   • Every persisted entity carries AuditFields (soft-delete via isDeleted).
 *   • Every REST endpoint wraps its payload in ApiResponse<T>.
 * ============================================================================
 */

/** CockroachDB primary key (UUID or STRING). */
export type ID = string;

/** ISO-8601 UTC timestamp string, e.g. "2026-08-23T09:30:00Z". */
export type IsoDateTime = string;

/** Standard envelope returned by every backend endpoint. */
export interface ApiResponse<T> {
  success: boolean;
  /** Present when success === true. */
  data: T;
  /** Human-readable message (used for toasts / errors). */
  message?: string;
  /** Machine-readable error code when success === false, e.g. "UNIT_NOT_FOUND". */
  errorCode?: string;
  timestamp: IsoDateTime;
}

/** Detailed error body (HTTP 4xx/5xx). */
export interface ApiError {
  success: false;
  errorCode: string;
  message: string;
  /** Optional per-field validation messages. */
  fieldErrors?: Record<string, string>;
  timestamp: IsoDateTime;
}

/** Audit columns present on every table/entity. */
export interface AuditFields {
  createdAt: IsoDateTime;
  createdBy: ID;
  updatedAt?: IsoDateTime;
  updatedBy?: ID;
  /** Soft-enable flag. */
  isActive: boolean;
  /** Soft-delete flag (rows are never hard-deleted). */
  isDeleted: boolean;
}

/** Pagination request (query params: ?page=&size=&sort=). */
export interface PageRequest {
  page: number;   // 0-based
  size: number;
  sort?: string;  // e.g. "createdAt,desc"
}

/** Pagination response wrapper. */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/* ----------------------------------------------------------------------------
 *  Domain enums (shared across Question Gen + Attainment)
 * ------------------------------------------------------------------------- */

/** Bloom's Taxonomy cognitive levels (L1 lowest → L6 highest). */
export type BloomLevel =
  | 'L1_REMEMBER'
  | 'L2_UNDERSTAND'
  | 'L3_APPLY'
  | 'L4_ANALYZE'
  | 'L5_EVALUATE'
  | 'L6_CREATE';

export const BLOOM_LEVELS: BloomLevel[] = [
  'L1_REMEMBER', 'L2_UNDERSTAND', 'L3_APPLY', 'L4_ANALYZE', 'L5_EVALUATE', 'L6_CREATE',
];

/** Short human labels for Bloom levels (UI display). */
export const BLOOM_LABELS: Record<BloomLevel, string> = {
  L1_REMEMBER: 'Remember',
  L2_UNDERSTAND: 'Understand',
  L3_APPLY: 'Apply',
  L4_ANALYZE: 'Analyze',
  L5_EVALUATE: 'Evaluate',
  L6_CREATE: 'Create',
};

/**
 * Attainment level after calculation:
 *  0 = Not attained, 1 = Low, 2 = Moderate, 3 = High.
 */
export type AttainmentLevel = 0 | 1 | 2 | 3;

/** CO→PO correlation strength in the mapping matrix (1 low, 2 medium, 3 high). */
export type CoPoCorrelation = 1 | 2 | 3;

/** Academic term. */
export type TermType = 'ODD' | 'EVEN';

/** Global academic context selected in the top bar. */
export interface AcademicContext {
  academicYear: string; // "2025-2026"
  term: TermType;       // "ODD"
}

/* ----------------------------------------------------------------------------
 *  Core academic entities (referenced by multiple features)
 * ------------------------------------------------------------------------- */

export interface Course extends Partial<AuditFields> {
  courseId: ID;
  courseCode: string;   // "CS301"
  courseName: string;   // "Data Structures & Algorithms"
  semester: number;     // 1..8
  academicYear: string; // "2025-2026"
  term: TermType;
  /** Faculty currently assigned as coordinator. */
  coordinatorId?: ID;
}

/** A Course Outcome (CO) belonging to a course. */
export interface CourseOutcome extends Partial<AuditFields> {
  coId: ID;
  courseId: ID;
  coCode: string;              // "CO1"
  statement: string;           // "Analyze time & space complexity of algorithms."
  targetBloomLevel: BloomLevel;
}

/** A Program Outcome (PO) / PSO — program-level, defined once per program. */
export interface ProgramOutcome {
  poId: ID;
  programId: ID;
  poCode: string;      // "PO1" | "PSO1"
  description: string;
  /** true for PSO (Program Specific Outcome), false for a standard PO. */
  isPso: boolean;
}
