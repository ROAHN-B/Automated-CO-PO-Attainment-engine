/**
 * ============================================================================
 *  vector-kb.model.ts  —  Vector Knowledge Base / Reference Materials
 * ============================================================================
 *  OWNERS:
 *   • Mayuri  → ingestion pipeline: parse → chunk → embed → store vectors.
 *   • Abhijeet→ persists SyllabusUnit / ReferenceMaterial metadata in CockroachDB.
 *
 *  FLOW ("upload once, query many"):
 *   Faculty picks/creates a SyllabusUnit → uploads ReferenceMaterial files →
 *   backend runs an IngestionJob (async) → unit becomes `isEmbedded` and is then
 *   available to the Question Generator (which never re-uploads files).
 * ============================================================================
 */
import { AuditFields, ID, IsoDateTime } from './common.model';

/** Lifecycle of a single document through Mayuri's pipeline. */
export type IngestionStatus =
  | 'PENDING'    // queued, not started
  | 'PARSING'    // extracting text (PDF/DOCX/PPTX → text)
  | 'CHUNKING'   // splitting into passages
  | 'EMBEDDING'  // creating vector embeddings
  | 'COMPLETED'  // vectors stored, queryable
  | 'FAILED';    // see errorMessage

export const INGESTION_STEP_ORDER: IngestionStatus[] = [
  'PENDING', 'PARSING', 'CHUNKING', 'EMBEDDING', 'COMPLETED',
];

/** What kind of reference document was uploaded. */
export type ReferenceMaterialType =
  | 'QUESTION_BANK'
  | 'PREVIOUS_PAPER'
  | 'LECTURE_PPT'
  | 'TEXTBOOK'
  | 'NOTES'
  | 'OTHER';

/**
 * A syllabus unit that owns a slice of the vector knowledge base.
 * GET /courses/{courseId}/units
 */
export interface SyllabusUnit extends Partial<AuditFields> {
  unitId: ID;
  courseId: ID;
  unitNumber: number;          // 1..n
  unitName: string;            // "Unit 3: Trees & Graphs"
  description?: string;

  /* ---- Vector KB summary (computed by backend) ---- */
  documentCount: number;       // reference materials attached
  chunkCount: number;          // total embedded chunks
  /** true once at least one material has COMPLETED embedding. */
  isEmbedded: boolean;
  lastIngestedAt?: IsoDateTime;
}

/**
 * A single uploaded reference document + its ingestion state.
 * GET /units/{unitId}/materials
 */
export interface ReferenceMaterial extends Partial<AuditFields> {
  materialId: ID;
  unitId: ID;
  courseId: ID;
  fileName: string;
  /** MIME type, e.g. "application/pdf". */
  mimeType: string;
  fileSizeBytes: number;
  materialType: ReferenceMaterialType;

  ingestionStatus: IngestionStatus;
  /** 0..100, for progress UI. */
  progressPercent: number;
  chunkCount?: number;
  /** Populated when ingestionStatus === 'FAILED'. */
  errorMessage?: string;

  uploadedAt: IsoDateTime;
  uploadedBy: ID;
}

/* ----------------------------------------------------------------------------
 *  Requests
 * ------------------------------------------------------------------------- */

/** Create a brand-new unit (used when faculty types a new unit name). */
export interface CreateUnitRequest {
  courseId: ID;
  unitNumber: number;
  unitName: string;
  description?: string;
}

/**
 * Metadata part of the multipart ingestion upload.
 * POST /units/ingest   (multipart/form-data)
 *   - part "meta": IngestReferenceRequest (JSON)
 *   - part "files": File[]
 * Exactly one of {unitId, newUnit} must be provided.
 */
export interface IngestReferenceRequest {
  /** Use an existing unit... */
  unitId?: ID;
  /** ...OR create a new one in the same call. */
  newUnit?: CreateUnitRequest;
  materialType: ReferenceMaterialType;
}

/* ----------------------------------------------------------------------------
 *  Responses
 * ------------------------------------------------------------------------- */

/**
 * Async ingestion job returned immediately after upload; the UI polls
 * GET /ingest/jobs/{jobId} until overallStatus is COMPLETED or FAILED.
 */
export interface IngestionJob {
  jobId: ID;
  unitId: ID;
  courseId: ID;
  materials: ReferenceMaterial[];
  overallStatus: IngestionStatus;
  overallProgressPercent: number; // 0..100 across all files
  startedAt: IsoDateTime;
  completedAt?: IsoDateTime;
}
