import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcademicYear, Program, Curriculum, Semester } from '../models/academic-structure.model';

@Injectable({
  providedIn: 'root'
})
export class AcademicStructureService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl || 'http://localhost:5000/api'}/academic`;

  // Mock data states for frontend standalone testing
  private mockAcademicYears: AcademicYear[] = [
    { id: 'ay_01', institutionId: 'inst_01', yearCode: '2025-2026', startDate: '2025-07-01', endDate: '2026-05-31', isCurrent: false, status: 'ACTIVE' },
    { id: 'ay_02', institutionId: 'inst_01', yearCode: '2026-2027', startDate: '2026-07-01', endDate: '2027-05-31', isCurrent: true, status: 'ACTIVE' }
  ];

  private mockPrograms: Program[] = [
    { id: 'prog_01', departmentId: 'dept_ecm', programCode: 'ECM', programName: 'Electronics and Computer Engineering', degreeType: 'B_TECH', durationYears: 4, status: 'ACTIVE' }
  ];

  private mockCurriculums: Curriculum[] = [
    { id: 'curr_2026', programId: 'prog_01', curriculumCode: 'CURR-2026', curriculumName: 'B.Tech ECM Revision 2026', effectiveFromYear: '2026-2027', totalSemesters: 8, status: 'ACTIVE' }
  ];

  private mockSemesters: Semester[] = [
    { id: 'sem_01', curriculumId: 'curr_2026', semesterNumber: 1, semesterCode: 'SEM-01', termType: 'ODD', status: 'ACTIVE' },
    { id: 'sem_02', curriculumId: 'curr_2026', semesterNumber: 2, semesterCode: 'SEM-02', termType: 'EVEN', status: 'ACTIVE' }
  ];

  // Academic Years APIs
  getAcademicYears(): Observable<AcademicYear[]> {
    if (environment.useMockData) {
      return of(this.mockAcademicYears);
    }
    return this.http.get<AcademicYear[]>(`${this.apiUrl}/academic-years`);
  }

  createAcademicYear(payload: Omit<AcademicYear, 'id'>): Observable<AcademicYear> {
    if (environment.useMockData) {
      const newYear: AcademicYear = { ...payload, id: 'ay_' + Date.now() };
      this.mockAcademicYears.push(newYear);
      return of(newYear);
    }
    return this.http.post<AcademicYear>(`${this.apiUrl}/academic-years`, payload);
  }

  // Programs APIs
  getPrograms(departmentId?: string): Observable<Program[]> {
    if (environment.useMockData) {
      return of(this.mockPrograms);
    }
    return this.http.get<Program[]>(`${this.apiUrl}/programs`, { params: departmentId ? { departmentId } : {} });
  }

  createProgram(payload: Omit<Program, 'id'>): Observable<Program> {
    if (environment.useMockData) {
      const newProg: Program = { ...payload, id: 'prog_' + Date.now() };
      this.mockPrograms.push(newProg);
      return of(newProg);
    }
    return this.http.post<Program>(`${this.apiUrl}/programs`, payload);
  }

  // Curriculums APIs
  getCurriculums(programId?: string): Observable<Curriculum[]> {
    if (environment.useMockData) {
      return of(this.mockCurriculums);
    }
    return this.http.get<Curriculum[]>(`${this.apiUrl}/curriculums`, { params: programId ? { programId } : {} });
  }

  createCurriculum(payload: Omit<Curriculum, 'id'>): Observable<Curriculum> {
    if (environment.useMockData) {
      const newCurr: Curriculum = { ...payload, id: 'curr_' + Date.now() };
      this.mockCurriculums.push(newCurr);
      return of(newCurr);
    }
    return this.http.post<Curriculum>(`${this.apiUrl}/curriculums`, payload);
  }

  // Semesters APIs
  getSemesters(curriculumId?: string): Observable<Semester[]> {
    if (environment.useMockData) {
      return of(this.mockSemesters);
    }
    return this.http.get<Semester[]>(`${this.apiUrl}/semesters`, { params: curriculumId ? { curriculumId } : {} });
  }
}