/**
 * Module 1: Academic Structure Models
 * Maps to academic_years, programs, curriculums, and semesters tables/logical entities.
 */

export interface AcademicYear {
  id: string;
  institutionId: string;
  yearCode: string;          // e.g., '2026-2027'
  startDate: string;         // ISO date
  endDate: string;           // ISO date
  isCurrent: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Program {
  id: string;
  departmentId: string;
  programCode: string;       // e.g., 'ECM'
  programName: string;       // e.g., 'Electronics and Computer Engineering'
  degreeType: 'B_TECH' | 'M_TECH' | 'PHD' | 'BSC' | 'MSC';
  durationYears: number;     // e.g., 4
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Curriculum {
  id: string;
  programId: string;
  curriculumCode: string;    // e.g., 'CURR-2026'
  curriculumName: string;    // e.g., 'B.Tech ECM Curriculum Revision 2026'
  effectiveFromYear: string; // e.g., '2026-2027'
  totalSemesters: number;    // e.g., 8
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
}

export interface Semester {
  id: string;
  curriculumId: string;
  semesterNumber: number;    // 1 to 8
  semesterCode: string;      // e.g., 'SEM-01'
  termType: 'ODD' | 'EVEN';
  status: 'ACTIVE' | 'INACTIVE';
}