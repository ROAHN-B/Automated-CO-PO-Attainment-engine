
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CourseOutcome {
  id: string;
  courseId: string;
  coCode: string;
  description: string;
  bloomLevel: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseOutcomePayload {
  courseId: string;
  coCode: string;
  description: string;
  bloomLevel: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CourseOutcomeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl =
    'http://localhost:8081/api/v1/course-outcomes';

  getByCourseId(
    courseId: string
  ): Observable<ApiResponse<CourseOutcome[]>> {
    return this.http.get<ApiResponse<CourseOutcome[]>>(
      this.baseUrl,
      { params: { courseId } }
    );
  }

  create(
    payload: CourseOutcomePayload
  ): Observable<ApiResponse<CourseOutcome>> {
    return this.http.post<ApiResponse<CourseOutcome>>(
      this.baseUrl,
      payload
    );
  }

  update(
    id: string,
    changes: Pick<CourseOutcomePayload, 'description' | 'bloomLevel'>
  ): Observable<ApiResponse<CourseOutcome>> {
    return this.http.put<ApiResponse<CourseOutcome>>(
      `${this.baseUrl}/${encodeURIComponent(id)}`,
      changes
    );
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.baseUrl}/${encodeURIComponent(id)}`
    );
  }
}
