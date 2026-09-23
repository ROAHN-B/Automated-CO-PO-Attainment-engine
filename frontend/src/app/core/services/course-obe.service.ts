import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CourseOutcomeEntity, CourseSyllabusUnit, ProgramOutcome, ProgramSpecificOutcome } from '../models/epic2-course-obe.model';

@Injectable({
  providedIn: 'root'
})
export class CourseObeService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl || 'http://localhost:5000/api'}/obe`;

  private mockCourseOutcomes: CourseOutcomeEntity[] = [
    { coId: 'co_01', courseId: 'crs_01', academicYearId: 'ay_2026', coCode: 'CO1', coStatement: 'Apply digital signal processing techniques to discrete signals.', targetBloomLevel: 'L3_APPLY', targetAttainment: 70, marksWeightage: 20, displayOrder: 1, status: 'ACTIVE' }
  ];

  // --- NEW: PO & PSO Mock Data ---
  private mockPOs: ProgramOutcome[] = [
    { poId: 'po_01', poCode: 'PO1', poStatement: 'Engineering knowledge: Apply the knowledge of mathematics, science, engineering fundamentals, and an engineering specialization to the solution of complex engineering problems.', status: 'ACTIVE' },
    { poId: 'po_02', poCode: 'PO2', poStatement: 'Problem analysis: Identify, formulate, review research literature, and analyze complex engineering problems.', status: 'ACTIVE' }
  ];

  private mockPSOs: ProgramSpecificOutcome[] = [
    { psoId: 'pso_01', programId: 'prog_01', psoCode: 'PSO1', psoStatement: 'Design, develop, and test electronic systems and communication networks.', status: 'ACTIVE' }
  ];

  // --- CO Methods ---
  getCourseOutcomes(courseId: string): Observable<CourseOutcomeEntity[]> {
    if (environment.useMockData) return of(this.mockCourseOutcomes.filter(co => co.courseId === courseId));
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

  // --- NEW: PO Methods ---
  getProgramOutcomes(): Observable<ProgramOutcome[]> {
    if (environment.useMockData) return of(this.mockPOs);
    return this.http.get<ProgramOutcome[]>(`${this.apiUrl}/program-outcomes`);
  }

  createProgramOutcome(payload: Omit<ProgramOutcome, 'poId'>): Observable<ProgramOutcome> {
    if (environment.useMockData) {
      const newPo = { ...payload, poId: 'po_' + Date.now() };
      this.mockPOs.push(newPo);
      return of(newPo);
    }
    return this.http.post<ProgramOutcome>(`${this.apiUrl}/program-outcomes`, payload);
  }

  // --- NEW: PSO Methods ---
  getProgramSpecificOutcomes(programId: string): Observable<ProgramSpecificOutcome[]> {
    if (environment.useMockData) return of(this.mockPSOs.filter(pso => pso.programId === programId));
    return this.http.get<ProgramSpecificOutcome[]>(`${this.apiUrl}/program-specific-outcomes`, { params: { programId } });
  }

  createProgramSpecificOutcome(payload: Omit<ProgramSpecificOutcome, 'psoId'>): Observable<ProgramSpecificOutcome> {
    if (environment.useMockData) {
      const newPso = { ...payload, psoId: 'pso_' + Date.now() };
      this.mockPSOs.push(newPso);
      return of(newPso);
    }
    return this.http.post<ProgramSpecificOutcome>(`${this.apiUrl}/program-specific-outcomes`, payload);
  }
}