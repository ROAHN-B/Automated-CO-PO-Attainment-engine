import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  CourseMaster, 
  CurriculumCourse,
  ElectiveGroup,
  CourseOffering,
  CourseSection
} from '../models/course-structure.model';

@Injectable({
  providedIn: 'root'
})
export class CourseStructureService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl || 'http://localhost:5000/api'}/courses`;

  // --- Mock Data ---
  private mockCourses: CourseMaster[] = [
    { courseId: 'crs_01', institutionId: 'inst_01', courseCode: 'EC301', courseName: 'Digital Signal Processing', courseType: 'THEORY', defaultCredits: 4, status: 'ACTIVE' },
    { courseId: 'crs_02', institutionId: 'inst_01', courseCode: 'EC302', courseName: 'Database Management Systems', courseType: 'HYBRID', defaultCredits: 4, status: 'ACTIVE' }
  ];

  private mockCurriculumCourses: CurriculumCourse[] = [
    { curriculumCourseId: 'cc_01', curriculumId: 'curr_01', semesterId: 'sem_01', courseId: 'crs_01', isElective: false, isMandatory: true, credits: 4, status: 'ACTIVE' },
    { curriculumCourseId: 'cc_02', curriculumId: 'curr_01', semesterId: 'sem_01', courseId: 'crs_02', isElective: false, isMandatory: true, credits: 4, status: 'ACTIVE' }
  ];

  private mockElectiveGroups: ElectiveGroup[] = [
    { electiveGroupId: 'eg_01', semesterId: 'sem_01', groupName: 'Professional Elective - I', groupType: 'PE', minSelection: 1, maxSelection: 1, status: 'ACTIVE' }
  ];

  private mockCourseOfferings: CourseOffering[] = [];
  private mockCourseSections: CourseSection[] = [];

  // --- Course Master APIs ---
  getCourses(): Observable<CourseMaster[]> {
    if (environment.useMockData) return of(this.mockCourses);
    return this.http.get<CourseMaster[]>(`${this.apiUrl}/master`);
  }

  createCourse(payload: Omit<CourseMaster, 'courseId'>): Observable<CourseMaster> {
    if (environment.useMockData) {
      const newCourse: CourseMaster = { ...payload, courseId: 'crs_' + Date.now() };
      this.mockCourses.push(newCourse);
      return of(newCourse);
    }
    return this.http.post<CourseMaster>(`${this.apiUrl}/master`, payload);
  }

  // --- Curriculum Mapping APIs ---
  getCurriculumCourses(curriculumId: string, semesterId?: string): Observable<CurriculumCourse[]> {
    if (environment.useMockData) {
      let filtered = this.mockCurriculumCourses.filter(cc => cc.curriculumId === curriculumId);
      if (semesterId) filtered = filtered.filter(cc => cc.semesterId === semesterId);
      return of(filtered);
    }
    return this.http.get<CurriculumCourse[]>(`${this.apiUrl}/curriculum-mapping`, {
      params: { curriculumId, ...(semesterId ? { semesterId } : {}) }
    });
  }

  mapCourseToCurriculum(payload: Omit<CurriculumCourse, 'curriculumCourseId'>): Observable<CurriculumCourse> {
    if (environment.useMockData) {
      const newMapping: CurriculumCourse = { ...payload, curriculumCourseId: 'cc_' + Date.now() };
      this.mockCurriculumCourses.push(newMapping);
      return of(newMapping);
    }
    return this.http.post<CurriculumCourse>(`${this.apiUrl}/curriculum-mapping`, payload);
  }

  // --- Elective Group APIs ---
  getElectiveGroups(semesterId: string): Observable<ElectiveGroup[]> {
    if (environment.useMockData) return of(this.mockElectiveGroups.filter(eg => eg.semesterId === semesterId));
    return this.http.get<ElectiveGroup[]>(`${this.apiUrl}/elective-groups`, { params: { semesterId } });
  }

  createElectiveGroup(payload: Omit<ElectiveGroup, 'electiveGroupId'>): Observable<ElectiveGroup> {
    if (environment.useMockData) {
      const newGroup: ElectiveGroup = { ...payload, electiveGroupId: 'eg_' + Date.now() };
      this.mockElectiveGroups.push(newGroup);
      return of(newGroup);
    }
    return this.http.post<ElectiveGroup>(`${this.apiUrl}/elective-groups`, payload);
  }

  // --- Course Offerings & Sections APIs ---
  getCourseOfferings(academicYearId: string): Observable<CourseOffering[]> {
    if (environment.useMockData) return of(this.mockCourseOfferings.filter(o => o.academicYearId === academicYearId));
    return this.http.get<CourseOffering[]>(`${this.apiUrl}/offerings`, { params: { academicYearId } });
  }

  createCourseOffering(payload: Omit<CourseOffering, 'courseOfferingId'>): Observable<CourseOffering> {
    if (environment.useMockData) {
      const newOffering: CourseOffering = { ...payload, courseOfferingId: 'offering_' + Date.now() };
      this.mockCourseOfferings.push(newOffering);
      return of(newOffering);
    }
    return this.http.post<CourseOffering>(`${this.apiUrl}/offerings`, payload);
  }

  getCourseSections(courseOfferingId: string): Observable<CourseSection[]> {
    if (environment.useMockData) return of(this.mockCourseSections.filter(s => s.courseOfferingId === courseOfferingId));
    return this.http.get<CourseSection[]>(`${this.apiUrl}/sections`, { params: { courseOfferingId } });
  }

  createCourseSection(payload: Omit<CourseSection, 'courseSectionId'>): Observable<CourseSection> {
    if (environment.useMockData) {
      const newSection: CourseSection = { ...payload, courseSectionId: 'sec_' + Date.now() };
      this.mockCourseSections.push(newSection);
      return of(newSection);
    }
    return this.http.post<CourseSection>(`${this.apiUrl}/sections`, payload);
  }
}