// src/app/core/api/faculty.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FacultyMetrics, ActiveCourse } from '../../shared/models/faculty.model';

@Injectable({
  providedIn: 'root'
})
export class FacultyService {
  private http = inject(HttpClient);
  
  // This URL will point to Abhijeet's Spring Boot server
  private apiUrl = 'http://localhost:8080/api/v1/faculty';

  getDashboardMetrics(): Observable<FacultyMetrics> {
    return this.http.get<FacultyMetrics>(`${this.apiUrl}/metrics`);
  }

  getActiveCourses(): Observable<ActiveCourse[]> {
    return this.http.get<ActiveCourse[]>(`${this.apiUrl}/courses/active`);
  }
}