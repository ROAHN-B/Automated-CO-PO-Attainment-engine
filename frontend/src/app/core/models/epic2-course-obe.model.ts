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