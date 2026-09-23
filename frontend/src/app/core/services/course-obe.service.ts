import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  CourseOutcomeEntity, 
  ProgramOutcome, 
  ProgramSpecificOutcome, 
  CoPoMapping, 
  CoPsoMapping 
} from '../models/epic2-course-obe.model';

@Injectable({
  providedIn: 'root'
})
export class CourseObeService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl || 'http://localhost:5000/api'}/obe`;

  // --- Mock Data ---
  private mockCourseOutcomes: CourseOutcomeEntity[] = [
    { coId: 'co_01', courseId: 'crs_01', academicYearId: 'ay_2026', coCode: 'CO1', coStatement: 'Apply digital signal processing techniques to discrete signals.', targetBloomLevel: 'L3_APPLY', targetAttainment: 70, marksWeightage: 20, displayOrder: 1, status: 'ACTIVE' },
    { coId: 'co_02', courseId: 'crs_01', academicYearId: 'ay_2026', coCode: 'CO2', coStatement: 'Analyze frequency response of digital filters.', targetBloomLevel: 'L4_ANALYZE', targetAttainment: 70, marksWeightage: 20, displayOrder: 2, status: 'ACTIVE' }
  ];

  private mockPOs: ProgramOutcome[] = [
    { poId: 'po_01', poCode: 'PO1', poStatement: 'Engineering knowledge', status: 'ACTIVE' },
    { poId: 'po_02', poCode: 'PO2', poStatement: 'Problem analysis', status: 'ACTIVE' },
    { poId: 'po_03', poCode: 'PO3', poStatement: 'Design/development of solutions', status: 'ACTIVE' }
  ];

  private mockPSOs: ProgramSpecificOutcome[] = [
    { psoId: 'pso_01', programId: 'prog_01', psoCode: 'PSO1', psoStatement: 'Design electronic systems', status: 'ACTIVE' },
    { psoId: 'pso_02', programId: 'prog_01', psoCode: 'PSO2', psoStatement: 'Develop software applications', status: 'ACTIVE' }
  ];

  private mockCoPoMappings: CoPoMapping[] = [];
  private mockCoPsoMappings: CoPsoMapping[] = [];

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

  // --- PO Methods ---
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

  // --- PSO Methods ---
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

  // --- Matrix Mapping Methods ---
  getCoPoMappings(courseId: string): Observable<CoPoMapping[]> {
    if (environment.useMockData) return of(this.mockCoPoMappings.filter(m => m.courseId === courseId));
    return this.http.get<CoPoMapping[]>(`${this.apiUrl}/mappings/copo`, { params: { courseId } });
  }

  saveCoPoMappings(mappings: CoPoMapping[]): Observable<{ success: boolean }> {
    if (environment.useMockData) {
      if (mappings.length > 0) {
        const courseId = mappings[0].courseId;
        this.mockCoPoMappings = this.mockCoPoMappings.filter(m => m.courseId !== courseId);
        this.mockCoPoMappings.push(...mappings);
      }
      return of({ success: true });
    }
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/mappings/copo`, { mappings });
  }

  getCoPsoMappings(courseId: string): Observable<CoPsoMapping[]> {
    if (environment.useMockData) return of(this.mockCoPsoMappings.filter(m => m.courseId === courseId));
    return this.http.get<CoPsoMapping[]>(`${this.apiUrl}/mappings/copso`, { params: { courseId } });
  }

  saveCoPsoMappings(mappings: CoPsoMapping[]): Observable<{ success: boolean }> {
    if (environment.useMockData) {
      if (mappings.length > 0) {
        const courseId = mappings[0].courseId;
        this.mockCoPsoMappings = this.mockCoPsoMappings.filter(m => m.courseId !== courseId);
        this.mockCoPsoMappings.push(...mappings);
      }
      return of({ success: true });
    }
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/mappings/copso`, { mappings });
  }
}