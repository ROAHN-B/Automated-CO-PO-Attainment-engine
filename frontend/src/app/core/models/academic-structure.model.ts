/**
 * Module 1: Academic Structure Models (Updated for V1.0 ER Diagram)
 * Maps to academic_years, programs, curriculums, and semesters tables.
 */

export interface AcademicYear {
  academicYearId?: string;
  academicYearCode: string;
  yearName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  institutionId?: string; // Kept as optional so older mock data doesn't break
}

export interface Program {
  programId?: string;
  departmentId: string;
  programName: string;
  programShortName: string;
  durationYears: number;
  status: string;
}

export interface Curriculum {
  curriculumId?: string;
  programId: string;
  curriculumYear: number;
  status: string;
}

export interface Semester {
  semesterId?: string;
  semesterCode: string;
  semesterName: string;
  semesterNumber: number;
  departmentId?: string;
  academicYearId?: string;
  curriculumId?: string;
  totalTeachingWeeks?: number;
  startDate?: string;
  endDate?: string;
  description?: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
}