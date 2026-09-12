/**
 * Module 1: Academic Structure Models (Updated for V1.0 ER Diagram)
 * Maps to academic_years, programs, curriculums, and semesters tables.
 */

export interface AcademicYear {
  academicYearId?: string;   // PK mapped to academic_year_id
  institutionId: string;     // FK mapped to institution_id
  yearName: string;          // e.g., '2026-2027' (from updated schema)
  startDate: string;         // ISO date (must be < endDate)
  endDate: string;           // ISO date
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Program {
  programId?: string;        // PK mapped to program_id
  departmentId: string;      // FK mapped to department_id
  programName: string;       // e.g., 'Electronics and Computer Engineering'
  programShortName: string;  // e.g., 'B.Tech ECM' (NEW)
  durationYears: number;     // e.g., 4
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Curriculum {
  curriculumId?: string;     // PK mapped to curriculum_id
  programId: string;         // FK mapped to program_id
  curriculumYear: number;    // e.g., 2026 (Changed from effectiveFromYear string)
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
}

export interface Semester {
  semesterId?: string;       // PK mapped to semester_id
  curriculumId: string;      // FK mapped to curriculum_id
  semesterName: string;      // e.g., 'Semester 1' (Merged from code/number)
  status: 'ACTIVE' | 'INACTIVE';
}