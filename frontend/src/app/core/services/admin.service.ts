/**
 * ============================================================================
 *  admin.service.ts  —  API_CONTRACT.md §6 (academic reads) and §16 (Super Admin)
 * ============================================================================
 *  Institution, academic years, departments, programs, and users with their
 *  roles. Live against the backend when environment.liveAreas includes "admin";
 *  otherwise it talks to the in-memory store in core/mocks/admin.mock.ts.
 * ============================================================================
 */
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, delay, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Page } from '../models/common.model';
import {
  AcademicYear, AcademicYearCreate, AcademicYearUpdate, AdminUser, Department, DepartmentCreate, DepartmentUpdate,
  Institution, InstitutionUpdate, Program, ProgramCreate, ProgramUpdate, RolesUpdate, UserCreate, UserQuery, UserUpdate,
} from '../models/admin.model';
import { AdminMockStore } from '../mocks/admin.mock';
import { toWorkspaceError } from './faculty-workspace.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly useMock = environment.useMockData && !environment.liveAreas.includes('admin');
  private readonly mock = this.useMock ? new AdminMockStore() : null;

  /* ---- ADM-1 ---- */

  institution(): Observable<Institution> {
    return this.call(() => this.mock!.institution(), () => this.get<Institution>('/institution'));
  }

  saveInstitution(body: InstitutionUpdate): Observable<Institution> {
    return this.call(() => this.mock!.saveInstitution(body), () => this.send<Institution>('PUT', '/institution', body), 450);
  }

  /* ---- ACAD-1, ACAD-2, ADM-2 ---- */

  academicYears(status?: AcademicYear['status']): Observable<AcademicYear[]> {
    const params = status ? new HttpParams({ fromObject: { status } }) : undefined;
    return this.call(() => this.mock!.academicYears(status), () => this.get<AcademicYear[]>('/academic-years', params));
  }

  createAcademicYear(body: AcademicYearCreate): Observable<AcademicYear> {
    return this.call(() => this.mock!.createAcademicYear(body), () => this.send<AcademicYear>('POST', '/academic-years', body), 400);
  }

  updateAcademicYear(id: string, body: AcademicYearUpdate): Observable<AcademicYear> {
    return this.call(() => this.mock!.updateAcademicYear(id, body), () => this.send<AcademicYear>('PATCH', `/academic-years/${id}`, body), 400);
  }

  makeCurrent(id: string): Observable<AcademicYear> {
    return this.call(() => this.mock!.makeCurrent(id), () => this.send<AcademicYear>('POST', `/academic-years/${id}/make-current`, {}), 400);
  }

  /* ---- ACAD-3, ADM-3 ---- */

  departments(): Observable<Department[]> {
    return this.call(() => this.mock!.departments(), () => this.get<Department[]>('/departments'));
  }

  createDepartment(body: DepartmentCreate): Observable<Department> {
    return this.call(() => this.mock!.createDepartment(body), () => this.send<Department>('POST', '/departments', body), 400);
  }

  updateDepartment(id: string, body: DepartmentUpdate): Observable<Department> {
    return this.call(() => this.mock!.updateDepartment(id, body), () => this.send<Department>('PATCH', `/departments/${id}`, body), 400);
  }

  /* ---- ACAD-4, ADM-4 ---- */

  programs(departmentId?: string): Observable<Program[]> {
    const params = departmentId ? new HttpParams({ fromObject: { departmentId } }) : undefined;
    return this.call(() => this.mock!.programs(departmentId), () => this.get<Program[]>('/programs', params));
  }

  createProgram(body: ProgramCreate): Observable<Program> {
    return this.call(() => this.mock!.createProgram(body), () => this.send<Program>('POST', '/programs', body), 400);
  }

  updateProgram(id: string, body: ProgramUpdate): Observable<Program> {
    return this.call(() => this.mock!.updateProgram(id, body), () => this.send<Program>('PATCH', `/programs/${id}`, body), 400);
  }

  /* ---- ADM-12 ---- */

  users(q: UserQuery): Observable<Page<AdminUser>> {
    const params = new HttpParams({ fromObject: Object.fromEntries(
      Object.entries({ ...q, page: q.page ?? 0, size: q.size ?? 20 }).filter(([, v]) => v !== undefined && v !== ''),
    ) as Record<string, string | number> });
    return this.call(() => this.mock!.userList(q), () => this.get<Page<AdminUser>>('/users', params));
  }

  createUser(body: UserCreate): Observable<AdminUser> {
    return this.call(() => this.mock!.createUser(body), () => this.send<AdminUser>('POST', '/users', body), 450);
  }

  updateUser(id: string, body: UserUpdate): Observable<AdminUser> {
    return this.call(() => this.mock!.updateUser(id, body, this.me()), () => this.send<AdminUser>('PATCH', `/users/${id}`, body), 450);
  }

  setRoles(id: string, body: RolesUpdate): Observable<AdminUser> {
    return this.call(() => this.mock!.setRoles(id, body, this.me()), () => this.send<AdminUser>('PUT', `/users/${id}/roles`, body), 450);
  }

  /** The mock's stand-in for the server knowing who is signed in. */
  private me(): string {
    try { return localStorage.getItem('user_email') ?? ''; } catch { return ''; }
  }

  private get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http.get<ApiResponse<T>>(`${this.base}${path}`, { params }).pipe(map(r => r.data));
  }

  private send<T>(method: 'POST' | 'PUT' | 'PATCH', path: string, body: unknown): Observable<T> {
    return this.http.request<ApiResponse<T>>(method, `${this.base}${path}`, { body }).pipe(map(r => r.data));
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
