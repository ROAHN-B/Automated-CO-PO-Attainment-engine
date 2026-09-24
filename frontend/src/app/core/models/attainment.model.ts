// 1. Configuration Model
export interface AttainmentConfiguration {
  configId?: string;
  courseId: string;
  targetPercentage: number;
  directWeightage: number;
  indirectWeightage: number;
  level1Threshold: number;
  level2Threshold: number;
  level3Threshold: number;
}

// 2. CO-PO Mapping Model
export interface CoPoMappingEntry {
  coId: string;
  coCode: string;
  poCode: string;
  correlation: number; // 1, 2, or 3
}

// 3. Calculation Request Model
export interface CalculateAttainmentRequest {
  courseId: string;
  config?: AttainmentConfiguration;
}

// 4. Sub-Models for the Report
export interface CoResult {
  coId: string;
  coCode: string;
  targetPercentage: number;
  studentsMeetingTarget: number;
  totalStudents: number;
  attainmentPercentage: number;
  directAttainment: number;
  indirectAttainment: number;
  finalAttainment: number;
  attainmentLevel: 0 | 1 | 2 | 3;
  gapDetected: boolean;
}

export interface PoResult {
  poCode: string;
  poDescription: string;
  attainmentValue: number;
  attainmentLevel: 0 | 1 | 2 | 3;
  contributingCoCodes: string[];
}

// 5. Main Report Model
export interface AttainmentReport {
  reportId?: string;
  courseId: string;
  courseCode: string;
  academicYear: string;
  term: string;
  config: AttainmentConfiguration;
  coResults: CoResult[];
  poResults: PoResult[];
  overallCoAttainment: number;
  overallPoAttainment: number;
  gapCount: number;
  status: 'DRAFT' | 'SUBMITTED_TO_HOD' | 'APPROVED' | 'REJECTED';
  generatedAt: string;
}
export interface CoAttainmentRecord {
  coId: string;
  description: string;
  directScore: number;
  indirectScore: number;
  finalScore: number;
  level: number;
}