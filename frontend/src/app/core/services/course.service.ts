/**
 * course.service.ts — course catalogue + Course Outcomes (Abhijeet / CockroachDB).
 * Shared by the wizard (CO mapping) and the attainment page.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Course, CourseOutcome } from '../models';

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly useMock = environment.useMockData;

  /** GET /courses — courses assigned to the signed-in faculty. */
  getCourses(): Observable<Course[]> {
    if (this.useMock) return of(MOCK_COURSES).pipe(delay(400));
    return this.http.get<ApiResponse<Course[]>>(`${this.base}/courses`).pipe(map(r => r.data));
  }

  /** GET /courses/{courseId}/outcomes — Course Outcomes for a course. */
  getCourseOutcomes(courseId: string): Observable<CourseOutcome[]> {
    if (this.useMock) return of(MOCK_COS.filter(c => c.courseId === courseId)).pipe(delay(400));
    return this.http
      .get<ApiResponse<CourseOutcome[]>>(`${this.base}/courses/${courseId}/outcomes`)
      .pipe(map(r => r.data));
  }
}

const MOCK_COURSES: Course[] = [
  { courseId: 'course-cs301', courseCode: 'CS301', courseName: 'Data Structures & Algorithms', semester: 3, academicYear: '2025-2026', term: 'ODD' },
  { courseId: 'course-ec204', courseCode: 'EC204', courseName: 'Digital Logic Design', semester: 2, academicYear: '2025-2026', term: 'ODD' },
  { courseId: 'course-ai502', courseCode: 'AI502', courseName: 'Agentic AI Systems', semester: 5, academicYear: '2025-2026', term: 'ODD' },
];

const MOCK_COS: CourseOutcome[] = [
  { coId: 'co-1', courseId: 'course-cs301', coCode: 'CO1', statement: 'Analyze the time and space complexity of algorithms.', targetBloomLevel: 'L4_ANALYZE' },
  { coId: 'co-2', courseId: 'course-cs301', coCode: 'CO2', statement: 'Implement non-linear structures (trees & graphs) in applications.', targetBloomLevel: 'L3_APPLY' },
  { coId: 'co-3', courseId: 'course-cs301', coCode: 'CO3', statement: 'Apply shortest-path and minimum-spanning-tree algorithms to real problems.', targetBloomLevel: 'L3_APPLY' },
  { coId: 'co-4', courseId: 'course-cs301', coCode: 'CO4', statement: 'Evaluate trade-offs between competing data-structure choices.', targetBloomLevel: 'L5_EVALUATE' },
];
