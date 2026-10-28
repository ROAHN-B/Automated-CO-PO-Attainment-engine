
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FacultyMetrics, ActiveCourse } from '../../shared/models/faculty.model';

export interface RealCourseOffering {
  offeringId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  courseType: string;
  credits: number;
  academicYear: string;
  semesterId: string;
  facultyId: string;
  status: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FacultyService {
  private http = inject(HttpClient);

  // Existing endpoints — unchanged
  private apiUrl = 'http://localhost:8080/api/v1/faculty';

  // Real Spring Boot backend
  private realApiUrl = 'http://localhost:8081/api/v1';

  getDashboardMetrics(): Observable<FacultyMetrics> {
    return this.http.get<FacultyMetrics>(`${this.apiUrl}/metrics`);
  }

  getActiveCourses(): Observable<ActiveCourse[]> {
    return this.http.get<ActiveCourse[]>(`${this.apiUrl}/courses/active`);
  }

  getRealDashboard(): Observable<any> {
    const facultyId = '6ae0b30416c39e3cbbca0a1c';
    const academicYear = '2026-27';

    return this.http.get<any>(
      `${this.realApiUrl}/faculty/${facultyId}/dashboard`,
      {
        params: { academicYear }
      }
    );
  }

  // Fetch an individual real course offering from MongoDB
  getRealCourseOffering(
    offeringId: string
  ): Observable<ApiResponse<RealCourseOffering>> {
    return this.http.get<ApiResponse<RealCourseOffering>>(
      `${this.realApiUrl}/offerings/${encodeURIComponent(offeringId)}`
    );
  }
}
