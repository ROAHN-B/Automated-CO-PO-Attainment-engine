import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  CourseMaster, 
  CurriculumCourse, 
  ElectiveGroup, 
  CourseOffering, 
  CourseFacultyAssignment 
} from '../models/course-structure.model';

@Injectable({
  providedIn: 'root'
})
export class CourseStructureService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl || 'http://localhost:5000/api'}/courses`;

  // Mock data states matching the updated CourseMaster model
  private mockCourses: CourseMaster[] = [
    { 
      id: 'crs_01', 
      institutionId: 'inst_01', 
      courseCode: 'EC301', 
      courseName: 'Digital Signal Processing', 
      credits: 4, 
      lectureHoursPerWeek: 3, 
      tutorialHoursPerWeek: 1, 
      practicalHoursPerWeek: 2, 
      courseType: 'HYBRID', 
      status: 'ACTIVE' 
    },
    { 
      id: 'crs_02', 
      institutionId: 'inst_01', 
      courseCode: 'EC302', 
      courseName: 'Database Management Systems', 
      credits: 4, 
      lectureHoursPerWeek: 3, 
      tutorialHoursPerWeek: 0, 
      practicalHoursPerWeek: 2, 
      courseType: 'HYBRID', 
      status: 'ACTIVE' 
    }
  ];

  private mockCurriculumCourses: CurriculumCourse[] = [
    { id: 'cc_01', curriculumId: 'curr_2026', semesterId: 'sem_01', courseId: 'crs_01', courseCategory: 'CORE', status: 'ACTIVE' }
  ];

  // Course Master APIs
  getCourses(): Observable<CourseMaster[]> {
    if (environment.useMockData) {
      return of(this.mockCourses);
    }
    return this.http.get<CourseMaster[]>(`${this.apiUrl}/master`);
  }

  createCourse(payload: Omit<CourseMaster, 'id'>): Observable<CourseMaster> {
    if (environment.useMockData) {
      const newCourse: CourseMaster = { ...payload, id: 'crs_' + Date.now() };
      this.mockCourses.push(newCourse);
      return of(newCourse);
    }
    return this.http.post<CourseMaster>(`${this.apiUrl}/master`, payload);
  }

  // Curriculum Mapping APIs
  getCurriculumCourses(curriculumId: string, semesterId?: string): Observable<CurriculumCourse[]> {
    if (environment.useMockData) {
      let filtered = this.mockCurriculumCourses.filter(cc => cc.curriculumId === curriculumId);
      if (semesterId) {
        filtered = filtered.filter(cc => cc.semesterId === semesterId);
      }
      return of(filtered);
    }
    return this.http.get<CurriculumCourse[]>(`${this.apiUrl}/curriculum-mapping`, {
      params: { curriculumId, ...(semesterId ? { semesterId } : {}) }
    });
  }

  mapCourseToCurriculum(payload: Omit<CurriculumCourse, 'id'>): Observable<CurriculumCourse> {
    if (environment.useMockData) {
      const newMapping: CurriculumCourse = { ...payload, id: 'cc_' + Date.now() };
      this.mockCurriculumCourses.push(newMapping);
      return of(newMapping);
    }
    return this.http.post<CurriculumCourse>(`${this.apiUrl}/curriculum-mapping`, payload);
  }
}