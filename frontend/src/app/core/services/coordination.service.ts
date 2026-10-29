/**
 * ============================================================================
 *  coordination.service.ts  —  API_CONTRACT.md v2.8 §15 (coordinator)  [A]
 * ============================================================================
 *  The department coordinator's semester setup. Step states, counts and
 *  validation come from the backend; this service only fetches and forwards.
 *  With `environment.useMockData` it talks to an in-memory store instead
 *  (core/mocks/coordination.mock.ts).
 * ============================================================================
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, from, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, ExportFile, Page } from '../models/common.model';
import {
  AcademicYearOption, AllocationBoard, AllocationCreate, AllocationNotification, CoordinatorOverview, CourseGroup, FacultyLoad,
  SubjectAllocation, FacultyCreate, FacultyImportPreview, FacultyImportResult,
  FacultyMember, FacultyUpdate, LoadDistribution, LoadDistributionUpdate, OutcomeSet, OutcomeSetUpdate, SemesterSetup,
  SemesterSetupCreate, SemesterSetupUpdate,
} from '../models/coordination.model';
import { OutcomeKind } from '../models/faculty-workspace.model';
import { coordinationMock } from '../mocks/mock-backend';
import { MockError } from '../mocks/mock-error';
import { readXlsx } from '../mocks/xlsx-lite';
import { toWorkspaceError } from './faculty-workspace.service';

@Injectable({ providedIn: 'root' })
export class CoordinationService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly useMock = environment.useMockData;
  private readonly mock = this.useMock ? coordinationMock() : null;

  /** ACAD-1 — GET /academic-years */
  academicYears(): Observable<AcademicYearOption[]> {
    return this.call(
      () => this.mock!.academicYears(),
      () => this.get<{ academicYearId: string; name: string; isCurrent: boolean }[]>('/academic-years')
        .pipe(map(ys => ys.map(y => ({ academicYearId: y.academicYearId, name: y.name, isCurrent: y.isCurrent })))),
      200,
    );
  }

  /** CRD-12 — GET /coordination/overview */
  overview(academicYearId?: string): Observable<CoordinatorOverview> {
    const params = academicYearId ? new HttpParams({ fromObject: { academicYearId } }) : undefined;
    return this.call(() => this.mock!.overview(academicYearId), () => this.get<CoordinatorOverview>('/coordination/overview', params), 450);
  }

  /** CRD-13 — POST /coordination/semester-setups */
  createSetup(body: SemesterSetupCreate): Observable<SemesterSetup> {
    return this.call(() => this.mock!.createSetup(body), () => this.post<SemesterSetup>('/coordination/semester-setups', body), 500);
  }

  /** CRD-14 — GET /coordination/semester-setups/{setupId} */
  setup(setupId: string): Observable<SemesterSetup> {
    return this.call(() => this.mock!.setup(setupId), () => this.get<SemesterSetup>(`/coordination/semester-setups/${setupId}`), 350);
  }

  /** CRD-15 — PATCH /coordination/semester-setups/{setupId} */
  updateSetup(setupId: string, body: SemesterSetupUpdate): Observable<SemesterSetup> {
    return this.call(
      () => this.mock!.updateSetup(setupId, body),
      () => this.patch<SemesterSetup>(`/coordination/semester-setups/${setupId}`, body),
      400,
    );
  }

  /* ------------------------------ faculty list (§15.3) ------------------------------ */

  /** CRD-1 — GET /coordination/faculty */
  facultyList(q: { status?: 'ACTIVE' | 'INACTIVE'; search?: string; page?: number; size?: number }): Observable<Page<FacultyMember>> {
    const params = new HttpParams({ fromObject: Object.fromEntries(
      Object.entries({ ...q, page: q.page ?? 0, size: q.size ?? 20 }).filter(([, v]) => v !== undefined && v !== ''),
    ) as Record<string, string | number> });
    return this.call(() => this.mock!.facultyList(q), () => this.get<Page<FacultyMember>>('/coordination/faculty', params), 350);
  }

  /** CRD-2 — POST /coordination/faculty */
  createFaculty(body: FacultyCreate): Observable<FacultyMember> {
    return this.call(() => this.mock!.createFaculty(body), () => this.post<FacultyMember>('/coordination/faculty', body), 450);
  }

  /** CRD-3 — PATCH /coordination/faculty/{userId} */
  updateFaculty(userId: string, body: FacultyUpdate): Observable<FacultyMember> {
    return this.call(() => this.mock!.updateFaculty(userId, body), () => this.patch<FacultyMember>(`/coordination/faculty/${userId}`, body), 450);
  }

  /** CRD-4 — POST /coordination/faculty/{userId}/resend-invite */
  resendInvite(userId: string): Observable<FacultyMember> {
    return this.call(() => this.mock!.resendInvite(userId), () => this.post<FacultyMember>(`/coordination/faculty/${userId}/resend-invite`, {}), 450);
  }

  /** CRD-16 — GET /coordination/faculty/import-template */
  facultyTemplate(): Observable<ExportFile> {
    return this.call(() => this.mock!.facultyTemplate(), () => this.get<ExportFile>('/coordination/faculty/import-template'), 300);
  }

  /** CRD-17 — POST /coordination/faculty/import (multipart). Returns a preview; nothing is imported yet. */
  importFaculty(file: File): Observable<FacultyImportPreview> {
    return this.callAsync(
      async () => {
        this.mock!.checkUpload(file.name, file.size);
        let sheet: string[][];
        try { sheet = await readXlsx(await file.arrayBuffer()); }
        catch { throw new MockError(422, 'BAD_TEMPLATE', 'This file couldn’t be read as an Excel workbook. Save it as .xlsx and try again.'); }
        return this.mock!.importPreview(file.name, sheet);
      },
      () => {
        const form = new FormData();
        form.append('meta', new Blob(['{}'], { type: 'application/json' }));
        form.append('file', file, file.name);
        return this.post<FacultyImportPreview>('/coordination/faculty/import', form);
      },
      700,
    );
  }

  /** CRD-18 — POST /coordination/faculty/import/{importId}/commit */
  commitImport(importId: string): Observable<FacultyImportResult> {
    return this.call(
      () => this.mock!.commitImport(importId),
      () => this.post<FacultyImportResult>(`/coordination/faculty/import/${importId}/commit`, {}),
      600,
    );
  }

  /* -------------------------- load distribution (§15.4) -------------------------- */

  /** CRD-19 — GET /coordination/semester-setups/{setupId}/load-distribution */
  loadDistribution(setupId: string): Observable<LoadDistribution> {
    return this.call(
      () => this.mock!.loadDistribution(setupId),
      () => this.get<LoadDistribution>(`/coordination/semester-setups/${setupId}/load-distribution`),
      400,
    );
  }

  /** CRD-20 — PUT /coordination/semester-setups/{setupId}/load-distribution */
  saveLoadDistribution(setupId: string, body: LoadDistributionUpdate): Observable<LoadDistribution> {
    return this.call(
      () => this.mock!.saveLoadDistribution(setupId, body),
      () => this.put<LoadDistribution>(`/coordination/semester-setups/${setupId}/load-distribution`, body),
      450,
    );
  }

  /** CRD-21 — POST …/load-distribution/declare */
  declareSyllabus(setupId: string, version: number): Observable<LoadDistribution> {
    const body = { version, confirmed: true };
    return this.call(
      () => this.mock!.declare(setupId, body),
      () => this.post<LoadDistribution>(`/coordination/semester-setups/${setupId}/load-distribution/declare`, body),
      600,
    );
  }

  /** CRD-22 — POST …/load-distribution/revise */
  reviseSyllabus(setupId: string, version: number, reason: string): Observable<LoadDistribution> {
    const body = { version, reason };
    return this.call(
      () => this.mock!.revise(setupId, body),
      () => this.post<LoadDistribution>(`/coordination/semester-setups/${setupId}/load-distribution/revise`, body),
      600,
    );
  }

  /** CRD-23 — GET /coordination/course-groups */
  courseGroups(): Observable<CourseGroup[]> {
    return this.call(() => this.mock!.courseGroups(), () => this.get<CourseGroup[]>('/coordination/course-groups'), 200);
  }

  /** CRD-24 — POST /coordination/course-groups */
  addCourseGroup(body: { code: string; name: string }): Observable<CourseGroup> {
    return this.call(() => this.mock!.addCourseGroup(body), () => this.post<CourseGroup>('/coordination/course-groups', body), 350);
  }

  /* ------------------------------ POs and PSOs (§15.5) ------------------------------ */

  /** CRD-25 (POs) / CRD-27 (the department's PSOs) */
  outcomes(kind: OutcomeKind): Observable<OutcomeSet> {
    const path = kind === 'PO' ? '/coordination/program-outcomes' : '/coordination/psos';
    return this.call(() => this.mock!.outcomes(kind), () => this.get<OutcomeSet>(path), 300);
  }

  /** CRD-26 (POs) / CRD-28 (PSOs) */
  saveOutcomes(kind: OutcomeKind, body: OutcomeSetUpdate): Observable<OutcomeSet> {
    const path = kind === 'PO' ? '/coordination/program-outcomes' : '/coordination/psos';
    return this.call(() => this.mock!.saveOutcomes(kind, body), () => this.put<OutcomeSet>(path, body), 450);
  }

  /** CRD-29 — GET /coordination/program-outcomes/history */
  outcomeVersions(kind: OutcomeKind): Observable<OutcomeSet[]> {
    return this.call(
      () => this.mock!.outcomeVersions(kind),
      () => this.get<OutcomeSet[]>('/coordination/program-outcomes/history', new HttpParams({ fromObject: { kind } })),
      300,
    );
  }

  /* --------------------------- allocation (§15.6, §15.7) --------------------------- */

  /** CRD-5 — GET /coordination/semester-setups/{setupId}/allocation-board */
  allocationBoard(setupId: string): Observable<AllocationBoard> {
    return this.call(
      () => this.mock!.allocationBoard(setupId),
      () => this.get<AllocationBoard>(`/coordination/semester-setups/${setupId}/allocation-board`),
      400,
    );
  }

  /** CRD-6 — POST /coordination/allocations */
  allocate(body: AllocationCreate): Observable<SubjectAllocation> {
    return this.call(() => this.mock!.createAllocation(body), () => this.post<SubjectAllocation>('/coordination/allocations', body), 300);
  }

  /** CRD-7 — PATCH /coordination/allocations/{allocationId} */
  reassign(allocationId: string, facultyUserId: string): Observable<SubjectAllocation> {
    return this.call(
      () => this.mock!.updateAllocation(allocationId, { facultyUserId }),
      () => this.patch<SubjectAllocation>(`/coordination/allocations/${allocationId}`, { facultyUserId }),
      350,
    );
  }

  /** CRD-8 — DELETE /coordination/allocations/{allocationId} */
  unallocate(allocationId: string): Observable<void> {
    return this.call(
      () => this.mock!.deleteAllocation(allocationId),
      () => this.http.delete<void>(`${this.base}/coordination/allocations/${allocationId}`),
      300,
    );
  }

  /** CRD-30 — GET /coordination/faculty-load */
  facultyLoad(academicYearId?: string): Observable<FacultyLoad[]> {
    const params = academicYearId ? new HttpParams({ fromObject: { academicYearId } }) : undefined;
    return this.call(() => this.mock!.facultyLoad(academicYearId), () => this.get<FacultyLoad[]>('/coordination/faculty-load', params), 350);
  }

  /** CRD-31 — POST …/allocation/complete */
  completeAllocation(setupId: string, version: number): Observable<AllocationBoard> {
    return this.call(
      () => this.mock!.completeAllocation(setupId, { version }),
      () => this.post<AllocationBoard>(`/coordination/semester-setups/${setupId}/allocation/complete`, { version }),
      900,
    );
  }

  /** CRD-32 — POST /coordination/allocations/{allocationId}/remind */
  remind(allocationId: string): Observable<SubjectAllocation> {
    return this.call(() => this.mock!.remind(allocationId), () => this.post<SubjectAllocation>(`/coordination/allocations/${allocationId}/remind`, {}), 400);
  }

  /** CRD-33 — GET /coordination/semester-setups/{setupId}/notifications */
  notifications(setupId: string): Observable<AllocationNotification[]> {
    return this.call(
      () => this.mock!.notifications(setupId),
      () => this.get<AllocationNotification[]>(`/coordination/semester-setups/${setupId}/notifications`),
      300,
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

  private patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<ApiResponse<T>>(`${this.base}${path}`, body).pipe(map(r => r.data));
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

  /** As `call`, for mock work that has to wait (e.g. reading an uploaded file). */
  private callAsync<T>(mockFn: () => Promise<T>, httpFn: () => Observable<T>, latency = 300): Observable<T> {
    const source$ = this.useMock ? defer(() => from(mockFn())).pipe(delay(latency)) : httpFn();
    return new Observable<T>(sub => source$.subscribe({
      next: v => sub.next(v),
      complete: () => sub.complete(),
      error: e => sub.error(toWorkspaceError(e)),
    }));
  }
}
