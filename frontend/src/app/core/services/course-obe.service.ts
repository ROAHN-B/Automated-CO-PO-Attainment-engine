import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CourseOutcomeEntity, CourseSyllabusUnit } from '../models/epic2-course-obe.model';

@Injectable({
  providedIn: 'root'
})
export class CourseObeService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl || 'http://localhost:5000/api'}/obe`;

  private mockCourseOutcomes: CourseOutcomeEntity[] = [
    {
      coId: 'co_01',
      courseId: 'crs_01',
      academicYearId: 'ay_2026',
      coCode: 'CO1',
      coStatement: 'Apply digital signal processing techniques to discrete signals.',
      targetBloomLevel: 'L3_APPLY',
      targetAttainment: 70,
      marksWeightage: 20,
      displayOrder: 1,
      status: 'ACTIVE'
    }
  ];

  getCourseOutcomes(courseId: string): Observable<CourseOutcomeEntity[]> {
    if (environment.useMockData) {
      return of(this.mockCourseOutcomes.filter(co => co.courseId === courseId));
    }
    return this.http.get<CourseOutcomeEntity[]>(`${this.apiUrl}/course-outcomes`, { params: { courseId } });
  }

  createCourseOutcome(payload: Omit<CourseOutcomeEntity, 'coId'>): Observable<CourseOutcomeEntity> {
    if (environment.useMockData) {
      const newCo: CourseOutcomeEntity = { ...payload, coId: 'co_' + Date.now() };
      this.mockCourseOutcomes.push(newCo);
      return of(newCo);
    }
    return this.http.post<CourseOutcomeEntity>(`${this.apiUrl}/course-outcomes`, payload);
  }
}