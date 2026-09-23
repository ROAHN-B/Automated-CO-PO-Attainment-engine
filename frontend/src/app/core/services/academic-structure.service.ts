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

  // Mock data states updated for EPIC-001 Enterprise Schema
  private mockAcademicYears: AcademicYear[] = [
    { 
      academicYearId: 'ay_2025', 
      academicYearCode: 'AY2025', 
      yearName: '2025-2026', 
      startDate: '2025-07-01', 
      endDate: '2026-05-31', 
      isCurrent: false, 
      status: 'ARCHIVED' 
    },
    { 
      academicYearId: 'ay_2026', 
      academicYearCode: 'AY2026', 
      yearName: '2026-2027', 
      startDate: '2026-07-01', 
      endDate: '2027-05-31', 
      isCurrent: true, 
      description: 'Current Academic Session', 
      status: 'ACTIVE' 
    }
  ];

  private mockPrograms: Program[] = [
    { programId: 'prog_01', departmentId: 'dept_ecm', programName: 'Electronics and Computer Engineering', programShortName: 'B.Tech ECM', durationYears: 4, status: 'ACTIVE' }
  ];

  private mockCurriculums: Curriculum[] = [
    { curriculumId: 'curr_01', programId: 'prog_01', curriculumYear: 2026, status: 'ACTIVE' }
  ];

  private mockSemesters: Semester[] = [
    { 
      semesterId: 'sem_01', 
      semesterCode: 'ECM-SEM-01', 
      semesterName: 'Semester 1', 
      semesterNumber: 1, 
      curriculumId: 'curr_01', 
      departmentId: 'dept_ecm', 
      totalTeachingWeeks: 16, 
      status: 'COMPLETED' 
    },
    { 
      semesterId: 'sem_02', 
      semesterCode: 'ECM-SEM-02', 
      semesterName: 'Semester 2', 
      semesterNumber: 2, 
      curriculumId: 'curr_01', 
      departmentId: 'dept_ecm', 
      totalTeachingWeeks: 16, 
      status: 'ACTIVE' 
    }
  ];

  // Academic Years APIs
  getAcademicYears(): Observable<AcademicYear[]> {
    if (environment.useMockData) {
      return of(this.mockAcademicYears);
    }
    return this.http.get<AcademicYear[]>(`${this.apiUrl}/academic-years`);
  }

  createAcademicYear(payload: Omit<AcademicYear, 'academicYearId'>): Observable<AcademicYear> {
    if (environment.useMockData) {
      // Simulate EPIC-001 business rule: Only one active year allowed
      if (payload.isCurrent) {
        this.mockAcademicYears.forEach(ay => ay.isCurrent = false);
      }
      
      const newYear: AcademicYear = { ...payload, academicYearId: 'ay_' + Date.now() };
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

  createProgram(payload: Omit<Program, 'programId'>): Observable<Program> {
    if (environment.useMockData) {
      const newProg: Program = { ...payload, programId: 'prog_' + Date.now() };
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

  createCurriculum(payload: Omit<Curriculum, 'curriculumId'>): Observable<Curriculum> {
    if (environment.useMockData) {
      const newCurr: Curriculum = { ...payload, curriculumId: 'curr_' + Date.now() };
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