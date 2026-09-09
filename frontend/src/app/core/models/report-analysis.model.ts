/**
 * ============================================================================
 *  report-analysis.model.ts  —  AI-driven Report Analysis (RAG over results)
 * ============================================================================
 *  OWNER:
 *   • Mayuri → an LLM/RAG endpoint that reads a course's AttainmentReport (and
 *              history) and returns a narrative: gaps, likely causes, trends,
 *              and concrete recommendations. This is generative (unlike the
 *              deterministic attainment math in attainment.model.ts).
 *
 *  POST /analysis/report  → ReportAnalysis
 * ============================================================================
 */
import { ID, IsoDateTime } from './common.model';

export type InsightCategory =
  | 'ATTAINMENT_GAP'   // a CO/PO fell short
  | 'STRENGTH'         // a CO/PO performed strongly
  | 'TREND'            // change over time
  | 'RECOMMENDATION'   // suggested pedagogical action
  | 'ACTION_ITEM';     // concrete next step for the faculty

export type InsightSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/** Request: analyse a specific report (or the latest for a course). */
export interface ReportAnalysisRequest {
  courseId: ID;
  /** If omitted, backend analyses the most recent report for the course. */
  reportId?: ID;
  /** Optional focus, e.g. ["CO2", "PO3"]. */
  focusAreas?: string[];
}

/** A single AI-generated insight. */
export interface AiInsight {
  insightId: ID;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  relatedCoCodes?: string[];
  relatedPoCodes?: string[];
  /** Concrete suggested actions tied to this insight. */
  recommendedActions?: string[];
  confidenceScore?: number; // 0..1
}

/** One point on the attainment-over-time trend. */
export interface AttainmentTrendPoint {
  period: string;              // "2023-24 ODD"
  overallCoAttainment: number; // %
  overallPoAttainment: number; // %
}

/** Full analysis payload. */
export interface ReportAnalysis {
  analysisId: ID;
  courseId: ID;
  courseCode: string;
  modelUsed: string;           // e.g. "gemini-2.5-pro"
  generatedAt: IsoDateTime;
  /** 2–3 sentence plain-language summary for the top of the page. */
  executiveSummary: string;
  insights: AiInsight[];
  trends: AttainmentTrendPoint[];
  gapCount: number;
  strengthCount: number;
}
