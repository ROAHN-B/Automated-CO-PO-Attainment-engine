/**
 * ============================================================================
 *  dashboard.model.ts  —  Faculty Dashboard summary hub
 * ============================================================================
 *  OWNER:
 *   • Abhijeet → aggregate queries across courses/COs/papers/reports.
 *  GET /dashboard/metrics , GET /dashboard/courses , GET /dashboard/activity
 * ============================================================================
 */
import { ID, IsoDateTime } from './common.model';

/** Headline metric readouts shown at the top of the dashboard. */
export interface DashboardMetrics {
  activeCourses: number;
  cosDefined: number;
  embeddedUnits: number;
  aiQuestionsGenerated: number;
  pendingReviews: number;
  reportsGenerated: number;
  /** Average final CO attainment across the faculty's active courses (%). */
  avgCoAttainment: number;
  /** Count of COs/POs currently flagged as a gap. */
  gapsDetected: number;
}

export type KbStatus = 'EMPTY' | 'PARTIAL' | 'READY';
export type QuestionStatus = 'NONE' | 'GENERATED' | 'REVIEWED';
export type CoPoStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'CALCULATED' | 'SUBMITTED';

/** Per-course status row for the dashboard table. */
export interface CourseSummary {
  courseId: ID;
  courseCode: string;
  courseName: string;
  semester: number;
  knowledgeBaseStatus: KbStatus;
  aiQuestionStatus: QuestionStatus;
  coPoStatus: CoPoStatus;
  /** Latest overall CO attainment (%), if calculated. */
  attainmentPercentage?: number;
  gapCount: number;
}

/** Recent-activity feed item. */
export interface ActivityItem {
  activityId: ID;
  /** Which workflow produced it. */
  kind: 'INGESTION' | 'GENERATION' | 'CALCULATION' | 'ANALYSIS' | 'SUBMISSION';
  summary: string;         // "Embedded 3 documents into Unit 3"
  courseCode?: string;
  occurredAt: IsoDateTime;
}
