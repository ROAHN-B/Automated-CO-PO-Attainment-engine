/**
 * ============================================================================
 *  attainment.service.ts  —  CO/PO Attainment (Abhijeet, deterministic, no AI)
 * ============================================================================
 *  Config + CO⇄PO matrix + the calculation engine + report submission.
 * ============================================================================
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  AttainmentConfiguration,
  AttainmentReport,
  CalculateAttainmentRequest,
  CoPoMappingEntry,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AttainmentService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly useMock = environment.useMockData;

  /** GET /courses/{courseId}/attainment/config */
  getConfig(courseId: string): Observable<AttainmentConfiguration> {
    if (this.useMock) return of({ ...MOCK_CONFIG, courseId }).pipe(delay(400));
    return this.http
      .get<ApiResponse<AttainmentConfiguration>>(`${this.base}/courses/${courseId}/attainment/config`)
      .pipe(map(r => r.data));
  }

  /** PUT /courses/{courseId}/attainment/config */
  saveConfig(config: AttainmentConfiguration): Observable<AttainmentConfiguration> {
    if (this.useMock) return of(config).pipe(delay(500));
    return this.http
      .put<ApiResponse<AttainmentConfiguration>>(`${this.base}/courses/${config.courseId}/attainment/config`, config)
      .pipe(map(r => r.data));
  }

  /** GET /courses/{courseId}/copo-matrix */
  getCoPoMatrix(courseId: string): Observable<CoPoMappingEntry[]> {
    if (this.useMock) return of(MOCK_COPO).pipe(delay(400));
    return this.http
      .get<ApiResponse<CoPoMappingEntry[]>>(`${this.base}/courses/${courseId}/copo-matrix`)
      .pipe(map(r => r.data));
  }

  /** POST /courses/{courseId}/attainment/calculate — the calculation engine. */
  calculate(req: CalculateAttainmentRequest): Observable<AttainmentReport> {
    if (this.useMock) return of(buildMockReport(req)).pipe(delay(2200));
    return this.http
      .post<ApiResponse<AttainmentReport>>(`${this.base}/courses/${req.courseId}/attainment/calculate`, req)
      .pipe(map(r => r.data));
  }

  /** POST /attainment/reports/{reportId}/submit — send to HOD for approval. */
  submitToHod(reportId: string): Observable<AttainmentReport> {
    if (this.useMock) return of({ ...buildMockReport({ courseId: 'course-cs301' }), reportId, status: 'SUBMITTED_TO_HOD' as const }).pipe(delay(700));
    return this.http
      .post<ApiResponse<AttainmentReport>>(`${this.base}/attainment/reports/${reportId}/submit`, {})
      .pipe(map(r => r.data));
  }
}

/* ============================== MOCK FIXTURES ============================== */

const MOCK_CONFIG: AttainmentConfiguration = {
  configId: 'cfg-cs301', courseId: 'course-cs301',
  targetPercentage: 60, directWeightage: 80, indirectWeightage: 20,
  level1Threshold: 40, level2Threshold: 60, level3Threshold: 75,
};

const MOCK_COPO: CoPoMappingEntry[] = [
  { coId: 'co-1', coCode: 'CO1', poCode: 'PO1', correlation: 3 },
  { coId: 'co-1', coCode: 'CO1', poCode: 'PO2', correlation: 2 },
  { coId: 'co-2', coCode: 'CO2', poCode: 'PO3', correlation: 3 },
  { coId: 'co-2', coCode: 'CO2', poCode: 'PO5', correlation: 2 },
  { coId: 'co-3', coCode: 'CO3', poCode: 'PO2', correlation: 3 },
  { coId: 'co-3', coCode: 'CO3', poCode: 'PO3', correlation: 2 },
  { coId: 'co-4', coCode: 'CO4', poCode: 'PO2', correlation: 2 },
  { coId: 'co-4', coCode: 'CO4', poCode: 'PO4', correlation: 1 },
];

function buildMockReport(req: CalculateAttainmentRequest): AttainmentReport {
  const cfg = req.config ?? MOCK_CONFIG;
  return {
    reportId: `rep-${Date.now()}`,
    courseId: req.courseId,
    courseCode: 'CS301',
    academicYear: '2025-2026',
    term: 'ODD',
    config: cfg,
    coResults: [
      { coId: 'co-1', coCode: 'CO1', targetPercentage: cfg.targetPercentage, studentsMeetingTarget: 51, totalStudents: 65, attainmentPercentage: 78.5, directAttainment: 80.1, indirectAttainment: 72.0, finalAttainment: 78.5, attainmentLevel: 3, gapDetected: false },
      { coId: 'co-2', coCode: 'CO2', targetPercentage: cfg.targetPercentage, studentsMeetingTarget: 35, totalStudents: 65, attainmentPercentage: 54.2, directAttainment: 52.0, indirectAttainment: 63.0, finalAttainment: 54.2, attainmentLevel: 1, gapDetected: true },
      { coId: 'co-3', coCode: 'CO3', targetPercentage: cfg.targetPercentage, studentsMeetingTarget: 43, totalStudents: 65, attainmentPercentage: 66.0, directAttainment: 65.0, indirectAttainment: 70.0, finalAttainment: 66.0, attainmentLevel: 2, gapDetected: false },
      { coId: 'co-4', coCode: 'CO4', targetPercentage: cfg.targetPercentage, studentsMeetingTarget: 47, totalStudents: 65, attainmentPercentage: 72.3, directAttainment: 71.0, indirectAttainment: 77.5, finalAttainment: 72.3, attainmentLevel: 2, gapDetected: false },
    ],
    poResults: [
      { poCode: 'PO1', poDescription: 'Engineering knowledge', attainmentValue: 2.6, attainmentLevel: 3, contributingCoCodes: ['CO1'] },
      { poCode: 'PO2', poDescription: 'Problem analysis', attainmentValue: 2.1, attainmentLevel: 2, contributingCoCodes: ['CO1', 'CO3', 'CO4'] },
      { poCode: 'PO3', poDescription: 'Design/development of solutions', attainmentValue: 1.7, attainmentLevel: 1, contributingCoCodes: ['CO2', 'CO3'] },
      { poCode: 'PO5', poDescription: 'Modern tool usage', attainmentValue: 2.0, attainmentLevel: 2, contributingCoCodes: ['CO2'] },
    ],
    overallCoAttainment: 67.8,
    overallPoAttainment: 2.1,
    gapCount: 1,
    status: 'DRAFT',
    generatedAt: new Date().toISOString(),
  };
}
