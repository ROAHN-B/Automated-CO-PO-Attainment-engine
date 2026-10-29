/**
 * ============================================================================
 *  faculty-workspace.service.ts  —  API_CONTRACT.md v2.8 §7, §8, §9, §10, §12 and §14  [A + M]
 * ============================================================================
 *  Course lifecycle, the CAM and its AI suggestions, question paper validation,
 *  the marksheet, the live course workbook and cumulative CO-PO attainment runs.
 *  Every attainment number is calculated by the backend; this service only
 *  fetches and forwards. With `environment.useMockData` it talks to an
 *  in-memory store instead (core/mocks/faculty-workspace.mock.ts).
 * ============================================================================
 */
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Cam, CamSuggestionSet, CamUpdate, UnitCoSuggestionSet } from '../models/cam.model';
import { ApiResponse, ExportFile, Page } from '../models/common.model';
import { AssessmentStructure } from '../models/marksheet.model';
import { QpPaper, QpPaperUpdate, QpSheetFormat, QpValidationResult } from '../models/question-paper.model';
import {
  AssessmentPlan, AssessmentPlanUpdate, AttainmentReadiness, AttainmentRun, AttainmentRunStatus, CourseWorkbook,
  FacultyDashboard, FacultyOffering, StudentCoScore, WorkbookStudentRow,
} from '../models/faculty-workspace.model';
import { FacultyWorkspaceMockStore, MockError } from '../mocks/faculty-workspace.mock';
import { coordinationMock } from '../mocks/mock-backend';

/** The signed-in user's email in mock mode (the real backend knows it from the token). */
const signedInEmail = (): string | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem('user_email'); } catch { return null; }
};

/** A user-safe error the screens can render: `message` is always displayable. */
export interface WorkspaceError {
  status: number;
  errorCode: string;
  message: string;
  /** Per-field messages for 400 VALIDATION_FAILED, keyed by request field path. */
  fieldErrors?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class FacultyWorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly useMock = environment.useMockData;
  private readonly mock = this.useMock ? new FacultyWorkspaceMockStore(coordinationMock(), signedInEmail) : null;

  /** FAC-3 — GET /me/dashboard */
  dashboard(): Observable<FacultyDashboard> {
    return this.call(() => this.mock!.dashboard(), () => this.get<FacultyDashboard>('/me/dashboard'), 450);
  }

  /** FAC-2 — GET /offerings/{offeringId} */
  offering(offeringId: string): Observable<FacultyOffering> {
    return this.call(() => this.mock!.offering(offeringId), () => this.get<FacultyOffering>(`/offerings/${offeringId}`));
  }

  /** FAC-4 — POST /offerings/{offeringId}/accept */
  acceptAllocation(offeringId: string): Observable<FacultyOffering> {
    return this.call(() => this.mock!.accept(offeringId), () => this.post<FacultyOffering>(`/offerings/${offeringId}/accept`, {}), 500);
  }

  /** PLAN-1 — GET /offerings/{offeringId}/assessment-plan */
  assessmentPlan(offeringId: string): Observable<AssessmentPlan> {
    return this.call(() => this.mock!.plan(offeringId), () => this.get<AssessmentPlan>(`/offerings/${offeringId}/assessment-plan`), 350);
  }

  /** PLAN-2 — PUT /offerings/{offeringId}/assessment-plan */
  saveAssessmentPlan(offeringId: string, body: AssessmentPlanUpdate): Observable<AssessmentPlan> {
    return this.call(
      () => this.mock!.savePlan(offeringId, body),
      () => this.put<AssessmentPlan>(`/offerings/${offeringId}/assessment-plan`, body),
      400,
    );
  }

  /** PLAN-3 — POST /offerings/{offeringId}/assessment-plan/finalize */
  finalizeAssessmentPlan(offeringId: string, version: number): Observable<AssessmentPlan> {
    return this.call(
      () => this.mock!.finalizePlan(offeringId, version),
      () => this.post<AssessmentPlan>(`/offerings/${offeringId}/assessment-plan/finalize`, { version }),
      600,
    );
  }

  /** CAM-1 — GET /offerings/{offeringId}/cam */
  cam(offeringId: string): Observable<Cam> {
    return this.call(() => this.mock!.cams.cam(offeringId), () => this.get<Cam>(`/offerings/${offeringId}/cam`), 400);
  }

  /** CAM-2 — PUT /offerings/{offeringId}/cam */
  saveCam(offeringId: string, update: CamUpdate): Observable<Cam> {
    return this.call(() => this.mock!.cams.save(offeringId, update), () => this.put<Cam>(`/offerings/${offeringId}/cam`, update), 450);
  }

  /** CAM-5 — POST /offerings/{offeringId}/cam/unit-mapping/suggestions (stage 1) */
  suggestUnitLinks(offeringId: string, coIds?: string[]): Observable<UnitCoSuggestionSet> {
    return this.call(
      () => this.mock!.cams.suggestUnits(offeringId, coIds),
      () => this.post<UnitCoSuggestionSet>(`/offerings/${offeringId}/cam/unit-mapping/suggestions`, coIds ? { coIds } : {}),
      1600,
    );
  }

  /** CAM-6 — POST /offerings/{offeringId}/cam/unit-mapping/confirm */
  confirmUnitMapping(offeringId: string, version: number): Observable<Cam> {
    return this.call(
      () => this.mock!.cams.confirmUnits(offeringId, version),
      () => this.post<Cam>(`/offerings/${offeringId}/cam/unit-mapping/confirm`, { version }),
      450,
    );
  }

  /** CAM-4 — POST /offerings/{offeringId}/cam/suggestions (stage 2) */
  suggestCells(offeringId: string, coIds?: string[]): Observable<CamSuggestionSet> {
    return this.call(
      () => this.mock!.cams.suggestCells(offeringId, coIds),
      () => this.post<CamSuggestionSet>(`/offerings/${offeringId}/cam/suggestions`, coIds ? { coIds } : {}),
      2200,
    );
  }

  /** CAM-3 — POST /offerings/{offeringId}/cam/finalize */
  finalizeCam(offeringId: string, version: number): Observable<Cam> {
    return this.call(
      () => this.mock!.cams.finalize(offeringId, version),
      () => this.post<Cam>(`/offerings/${offeringId}/cam/finalize`, { version }),
      700,
    );
  }

  /** QPV-1 — GET /assessments/{assessmentId}/question-paper (also the poll while ANALYZING) */
  questionPaper(assessmentId: string, latency = 400): Observable<QpPaper> {
    return this.call(() => this.mock!.papers.paper(assessmentId), () => this.get<QpPaper>(`/assessments/${assessmentId}/question-paper`), latency);
  }

  /** QPV-2 — PUT /assessments/{assessmentId}/question-paper */
  saveQuestionPaper(assessmentId: string, update: QpPaperUpdate): Observable<QpPaper> {
    return this.call(
      () => this.mock!.papers.save(assessmentId, update),
      () => this.put<QpPaper>(`/assessments/${assessmentId}/question-paper`, update),
      450,
    );
  }

  /** QPV-3 — POST /assessments/{assessmentId}/question-paper/validate (202, ANALYZING) */
  validateQuestionPaper(assessmentId: string, version: number): Observable<QpPaper> {
    return this.call(
      () => this.mock!.papers.validate(assessmentId, version),
      () => this.post<QpPaper>(`/assessments/${assessmentId}/question-paper/validate`, { version }),
      500,
    );
  }

  /** QPV-4 — GET /assessments/{assessmentId}/question-paper/result */
  questionPaperResult(assessmentId: string): Observable<QpValidationResult> {
    return this.call(
      () => this.mock!.papers.result(assessmentId),
      () => this.get<QpValidationResult>(`/assessments/${assessmentId}/question-paper/result`),
      350,
    );
  }

  /** QPV-5 — POST /assessments/{assessmentId}/question-paper/moderation-sheet (ISE only) */
  moderationSheet(assessmentId: string, format: QpSheetFormat): Observable<ExportFile> {
    return this.call(
      () => this.mock!.papers.moderationSheet(assessmentId, format),
      () => this.post<ExportFile>(`/assessments/${assessmentId}/question-paper/moderation-sheet`, { format }),
      700,
    );
  }

  /** QPV-6 — POST /assessments/{assessmentId}/question-paper/finalize (Confirm paper) */
  confirmQuestionPaper(assessmentId: string, version: number): Observable<QpPaper> {
    return this.call(
      () => this.mock!.papers.finalize(assessmentId, version),
      () => this.post<QpPaper>(`/assessments/${assessmentId}/question-paper/finalize`, { version }),
      700,
    );
  }

  /** QPV-8 — POST /assessments/{assessmentId}/question-paper/reopen */
  reopenQuestionPaper(assessmentId: string, version: number): Observable<QpPaper> {
    return this.call(
      () => this.mock!.papers.reopen(assessmentId, version),
      () => this.post<QpPaper>(`/assessments/${assessmentId}/question-paper/reopen`, { version }),
      500,
    );
  }

  /** MS-1 — GET /assessments/{assessmentId}/structure */
  marksheet(assessmentId: string): Observable<AssessmentStructure> {
    return this.call(
      () => this.mock!.marksheets.structure(assessmentId),
      () => this.get<AssessmentStructure>(`/assessments/${assessmentId}/structure`),
      400,
    );
  }

  /** MS-3 — POST /assessments/{assessmentId}/structure/finalize */
  finalizeMarksheet(assessmentId: string, version: number): Observable<AssessmentStructure> {
    return this.call(
      () => this.mock!.marksheets.finalize(assessmentId, version),
      () => this.post<AssessmentStructure>(`/assessments/${assessmentId}/structure/finalize`, { version }),
      700,
    );
  }

  /** MS-4 — POST /assessments/{assessmentId}/marksheet-template */
  marksheetTemplate(assessmentId: string): Observable<ExportFile> {
    return this.call(
      () => this.mock!.marksheets.template(assessmentId),
      () => this.post<ExportFile>(`/assessments/${assessmentId}/marksheet-template`, {}),
      600,
    );
  }

  /** WB-1 — GET /offerings/{offeringId}/workbook */
  workbook(offeringId: string): Observable<CourseWorkbook> {
    return this.call(() => this.mock!.workbook(offeringId), () => this.get<CourseWorkbook>(`/offerings/${offeringId}/workbook`), 500);
  }

  /** WB-2 — GET /offerings/{offeringId}/workbook/data/students */
  workbookStudents(offeringId: string, page: number, size: number, search = ''): Observable<Page<WorkbookStudentRow>> {
    const params = new HttpParams({ fromObject: { page, size, ...(search ? { search } : {}) } });
    return this.call(
      () => this.mock!.workbookStudents(offeringId, page, size, search),
      () => this.get<Page<WorkbookStudentRow>>(`/offerings/${offeringId}/workbook/data/students`, params),
      250,
    );
  }

  /** ATT-1 — GET /offerings/{offeringId}/attainment/readiness */
  readiness(offeringId: string, upToAssessmentId?: string): Observable<AttainmentReadiness> {
    const params = new HttpParams({ fromObject: upToAssessmentId ? { upToAssessmentId } : {} });
    return this.call(
      () => this.mock!.readiness(offeringId, upToAssessmentId),
      () => this.get<AttainmentReadiness>(`/offerings/${offeringId}/attainment/readiness`, params),
      400,
    );
  }

  /** The course's current un-approved preview (ATT-4 filtered to CALCULATED), if any. */
  currentPreview(offeringId: string): Observable<AttainmentRun | null> {
    return this.call(
      () => this.mock!.preview(offeringId),
      () => this.get<AttainmentRun[]>(`/offerings/${offeringId}/attainment/runs`,
        new HttpParams({ fromObject: { status: 'CALCULATED' satisfies AttainmentRunStatus } }))
        .pipe(map(runs => runs[0] ?? null)),
      200,
    );
  }

  /** ATT-2 — POST /offerings/{offeringId}/attainment/runs */
  calculate(offeringId: string, body: { upToAssessmentId?: string; final?: boolean }): Observable<AttainmentRun> {
    return this.call(
      () => this.mock!.calculate(offeringId, body.upToAssessmentId),
      () => this.post<AttainmentRun>(`/offerings/${offeringId}/attainment/runs`, body),
      1400,
    );
  }

  /** ATT-11 — POST /attainment/runs/{runId}/approve */
  approve(run: AttainmentRun): Observable<AttainmentRun> {
    return this.call(
      () => this.mock!.approve(run.runId),
      () => this.post<AttainmentRun>(`/attainment/runs/${run.runId}/approve`, { version: run.version }),
      700,
    );
  }

  /** ATT-12 — POST /attainment/runs/{runId}/discard */
  discard(runId: string): Observable<AttainmentRun> {
    return this.call(() => this.mock!.discard(runId), () => this.post<AttainmentRun>(`/attainment/runs/${runId}/discard`, {}), 400);
  }

  /** ATT-10 — GET /attainment/runs/{runId}/cos/{coId}/students (first page is enough for the drawer) */
  runStudents(runId: string, coId: string): Observable<StudentCoScore[]> {
    return this.call(
      () => this.mock!.runStudents(runId, coId),
      () => this.get<Page<StudentCoScore>>(`/attainment/runs/${runId}/cos/${coId}/students`,
        new HttpParams({ fromObject: { page: 0, size: 500 } })).pipe(map(p => p.content)),
      350,
    );
  }

  /* -------------------------------- plumbing -------------------------------- */

  private get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http.get<ApiResponse<T>>(`${this.base}${path}`, { params }).pipe(map(r => r.data));
  }

  private put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(`${this.base}${path}`, body).pipe(map(r => r.data));
  }

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<ApiResponse<T>>(`${this.base}${path}`, body).pipe(map(r => r.data));
  }

  /** Runs the mock or the HTTP call and normalises failures into a WorkspaceError. */
  private call<T>(mockFn: () => T, httpFn: () => Observable<T>, latency = 300): Observable<T> {
    const source$ = this.useMock
      ? defer(() => {
          try { return of(mockFn()).pipe(delay(latency)); }
          catch (e) { return throwError(() => e); }
        })
      : httpFn();
    return new Observable<T>(sub => source$.subscribe({
      next: v => sub.next(v),
      complete: () => sub.complete(),
      error: e => sub.error(toWorkspaceError(e)),
    }));
  }
}

/** Normalises a mock or HTTP failure into a user-safe WorkspaceError. */
export function toWorkspaceError(e: unknown): WorkspaceError {
  if (e instanceof MockError) return { status: e.status, errorCode: e.errorCode, message: e.message, fieldErrors: e.fieldErrors };
  if (e instanceof HttpErrorResponse) {
    const body = e.error as { errorCode?: string; message?: string; fieldErrors?: Record<string, string> } | null;
    return {
      status: e.status,
      errorCode: body?.errorCode ?? (e.status === 0 ? 'NETWORK' : 'INTERNAL_ERROR'),
      message: body?.message ?? (e.status === 0 ? 'Can’t reach the server. Check your connection and try again.' : 'Something went wrong. Please try again.'),
      fieldErrors: body?.fieldErrors,
    };
  }
  return { status: 500, errorCode: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' };
}
