/**
 * dashboard.service.ts — summary metrics, course status rows, recent activity
 * (Abhijeet / CockroachDB aggregate queries).
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActivityItem, ApiResponse, CourseSummary, DashboardMetrics } from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly useMock = environment.useMockData;

  /** GET /dashboard/metrics */
  getMetrics(): Observable<DashboardMetrics> {
    if (this.useMock) return of(MOCK_METRICS).pipe(delay(450));
    return this.http.get<ApiResponse<DashboardMetrics>>(`${this.base}/dashboard/metrics`).pipe(map(r => r.data));
  }

  /** GET /dashboard/courses */
  getCourseSummaries(): Observable<CourseSummary[]> {
    if (this.useMock) return of(MOCK_COURSE_SUMMARIES).pipe(delay(550));
    return this.http.get<ApiResponse<CourseSummary[]>>(`${this.base}/dashboard/courses`).pipe(map(r => r.data));
  }

  /** GET /dashboard/activity */
  getRecentActivity(): Observable<ActivityItem[]> {
    if (this.useMock) return of(MOCK_ACTIVITY).pipe(delay(600));
    return this.http.get<ApiResponse<ActivityItem[]>>(`${this.base}/dashboard/activity`).pipe(map(r => r.data));
  }
}

/* ============================== MOCK FIXTURES ============================== */

const MOCK_METRICS: DashboardMetrics = {
  activeCourses: 3,
  cosDefined: 18,
  embeddedUnits: 7,
  aiQuestionsGenerated: 45,
  pendingReviews: 6,
  reportsGenerated: 2,
  avgCoAttainment: 67.8,
  gapsDetected: 2,
};

const MOCK_COURSE_SUMMARIES: CourseSummary[] = [
  { courseId: 'course-cs301', courseCode: 'CS301', courseName: 'Data Structures & Algorithms', semester: 3, knowledgeBaseStatus: 'READY', aiQuestionStatus: 'REVIEWED', coPoStatus: 'CALCULATED', attainmentPercentage: 67.8, gapCount: 1 },
  { courseId: 'course-ec204', courseCode: 'EC204', courseName: 'Digital Logic Design', semester: 2, knowledgeBaseStatus: 'PARTIAL', aiQuestionStatus: 'GENERATED', coPoStatus: 'IN_PROGRESS', gapCount: 0 },
  { courseId: 'course-ai502', courseCode: 'AI502', courseName: 'Agentic AI Systems', semester: 5, knowledgeBaseStatus: 'EMPTY', aiQuestionStatus: 'NONE', coPoStatus: 'NOT_STARTED', gapCount: 0 },
];

const MOCK_ACTIVITY: ActivityItem[] = [
  { activityId: 'a1', kind: 'CALCULATION', summary: 'Ran attainment for CS301 — CO2 flagged as a gap', courseCode: 'CS301', occurredAt: '2026-08-23T05:40:00Z' },
  { activityId: 'a2', kind: 'GENERATION', summary: 'Generated 8 questions for Unit 3 (Trees & Graphs)', courseCode: 'CS301', occurredAt: '2026-08-22T11:20:00Z' },
  { activityId: 'a3', kind: 'INGESTION', summary: 'Embedded 2 documents into Unit 3', courseCode: 'CS301', occurredAt: '2026-08-21T04:05:00Z' },
];
