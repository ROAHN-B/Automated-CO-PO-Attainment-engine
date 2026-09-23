export type BloomLevel = 
  | 'L1_REMEMBER' 
  | 'L2_UNDERSTAND' 
  | 'L3_APPLY' 
  | 'L4_ANALYZE' 
  | 'L5_EVALUATE' 
  | 'L6_CREATE';

export interface CourseOutcomeEntity {
  coId?: string;
  courseId: string;
  academicYearId: string;
  coCode: string; // e.g. CO1
  coStatement: string;
  targetBloomLevel: BloomLevel;
  targetAttainment: number; // e.g. 70 (%)
  marksWeightage: number;
  displayOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CourseSyllabusUnit {
  _id?: string;
  courseId: string;
  academicYearId: string;
  unitCode: string; // e.g. U1
  unitTitle: string;
  unitDescription?: string;
  recommendedHours?: number;
  displayOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ProgramOutcome {
  poId?: string;
  poCode: string; // e.g., PO1
  poStatement: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ProgramSpecificOutcome {
  psoId?: string;
  programId: string; // PSOs are specific to a program
  psoCode: string; // e.g., PSO1
  psoStatement: string;
  status: 'ACTIVE' | 'INACTIVE';
}

// --- Matrix Mapping Interfaces ---
export interface CoPoMapping {
  mappingId?: string;
  courseId: string;
  coId: string;
  poId: string;
  correlationLevel: 1 | 2 | 3 | null; // 1: Low, 2: Medium, 3: High
}

export interface CoPsoMapping {
  mappingId?: string;
  courseId: string;
  coId: string;
  psoId: string;
  correlationLevel: 1 | 2 | 3 | null;
}