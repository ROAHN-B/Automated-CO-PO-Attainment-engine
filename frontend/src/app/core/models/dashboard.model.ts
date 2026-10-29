/**
 * ============================================================================
 *  dashboard.model.ts  —  Faculty Dashboard summary hub
 * ============================================================================
 *  OWNER:
 *   • Abhijeet → aggregate queries across courses/COs/reports.
 *  GET /dashboard/metrics , GET /dashboard/courses , GET /dashboard/activity
 * ============================================================================
 */
import { ID, IsoDateTime } from './common.model';

/** Headline metric readouts shown at the top of the dashboard. */
export interface DashboardMetrics {
  activeCourses: number;
  cosDefined: number;
  pendingReviews: number;
  reportsGenerated: number;
  /** Average final CO attainment across the faculty's active courses (%). */
  avgCoAttainment: number;
  /** Count of COs/POs currently flagged as a gap. */
  gapsDetected: number;
}

export type CoPoStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'CALCULATED' | 'SUBMITTED';

/** Per-course status row for the dashboard table. */
export interface CourseSummary {
  courseId: ID;
  courseCode: string;
  courseName: string;
  semester: number;
  coPoStatus: CoPoStatus;
  /** Latest overall CO attainment (%), if calculated. */
  attainmentPercentage?: number;
  gapCount: number;
}

/** Recent-activity feed item. */
export interface ActivityItem {
  activityId: ID;
  /** Which workflow produced it. */
  kind: 'CALCULATION' | 'ANALYSIS' | 'SUBMISSION';
  summary: string;         // "Ran attainment for CS301"
  courseCode?: string;
  occurredAt: IsoDateTime;
}
