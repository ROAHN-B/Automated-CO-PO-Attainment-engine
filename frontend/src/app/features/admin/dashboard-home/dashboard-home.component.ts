import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, throwError } from 'rxjs';
import { AcademicYear, Department, Institution, Program } from '../../../core/models/admin.model';
import { AdminService } from '../../../core/services/admin.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../shared/ui/icon.component';

interface Overview {
  institution: Institution | null;
  currentYear: AcademicYear | null;
  departments: Department[];
  programs: Program[];
  users: number;
  coordinators: number;
}

/** Super Admin landing page: the institution's setup at a glance, from the §6 and §16 reads. */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="page stagger">
      <header class="page-header" style="--i:0">
        <div>
          <p class="page-kicker">Administration</p>
          <h1 class="page-title">{{ data()?.institution?.institutionName ?? 'Overview' }}</h1>
          <p class="page-subtitle">The academic calendar, departments and people the rest of the platform works with.</p>
        </div>
        <div class="page-actions">
          <a routerLink="/admin/users" class="btn btn-primary">
            <app-icon name="users" class="h-4 w-4" /> Users and roles
          </a>
        </div>
      </header>

      @if (error()) {
        <div class="alert alert-error mt-8" role="alert">
          <app-icon name="alert" class="mt-0.5 h-4 w-4" />
          <div class="flex-1"><p class="font-semibold">Couldn’t load the overview</p><p class="mt-0.5">{{ error() }}</p></div>
          <button type="button" class="btn btn-outline btn-sm" (click)="load()">Try again</button>
        </div>
      } @else if (!data()) {
        <div class="skeleton mt-8 h-64" aria-busy="true" aria-label="Loading the overview"></div>
      } @else { @let o = data()!;
        @if (!o.institution) {
          <div class="alert alert-info mt-8" role="status">
            <app-icon name="building" class="mt-0.5 h-4 w-4" />
            <p class="flex-1">The institution hasn’t been set up yet.</p>
            <a routerLink="/admin/institution-setup" class="btn btn-outline btn-sm">Set it up</a>
          </div>
        }

        <section class="panel mt-8" style="--i:1" aria-label="Setup at a glance">
          <div class="panel-grid grid-cols-2 lg:grid-cols-4">
            <div class="panel-cell px-6 py-6">
              <p class="stat-label">Current year</p>
              <p class="stat-value">{{ o.currentYear?.name ?? '—' }}</p>
              <p class="stat-meta">{{ o.currentYear ? 'new setups use it' : 'none marked current' }}</p>
            </div>
            <div class="panel-cell px-6 py-6">
              <p class="stat-label">Departments</p>
              <p class="stat-value">{{ activeCount(o.departments) }}</p>
              <p class="stat-meta">active</p>
            </div>
            <div class="panel-cell px-6 py-6">
              <p class="stat-label">Programs</p>
              <p class="stat-value">{{ activeCount(o.programs) }}</p>
              <p class="stat-meta">active</p>
            </div>
            <div class="panel-cell px-6 py-6">
              <p class="stat-label">Users</p>
              <p class="stat-value">{{ o.users }}</p>
              <p class="stat-meta">{{ o.coordinators }} {{ o.coordinators === 1 ? 'coordinator' : 'coordinators' }}</p>
            </div>
          </div>
        </section>

        <section class="card mt-8 overflow-hidden" style="--i:2" aria-labelledby="dh-depts">
          <div class="card-header">
            <div>
              <h2 id="dh-depts" class="section-title">Departments</h2>
              <p class="section-subtitle">Each department’s coordinator sets up its semesters and allocates subjects.</p>
            </div>
            <a routerLink="/admin/academic-config" class="btn btn-ghost btn-sm">
              Manage <app-icon name="chevronRight" class="h-3.5 w-3.5" />
            </a>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="th" scope="col">Code</th>
                  <th class="th" scope="col">Department</th>
                  <th class="th text-right" scope="col">Programs</th>
                </tr>
              </thead>
              <tbody>
                @for (d of o.departments; track d.departmentId) {
                  <tr [class.opacity-60]="d.status !== 'ACTIVE'">
                    <td class="td font-mono text-[13px]">{{ d.departmentCode }}</td>
                    <td class="td font-medium text-ink">{{ d.departmentName }}</td>
                    <td class="td tnum text-right">{{ programCount(o.programs, d.departmentId) }}</td>
                  </tr>
                } @empty {
                  <tr><td class="td py-10 text-center text-ink-muted" colspan="3">No departments yet.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
})
export class DashboardHomeComponent {
  private readonly api = inject(AdminService);

  readonly data = signal<Overview | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.error.set(null);
    forkJoin({
      // No institution yet (404) is the normal first-run state.
      institution: this.api.institution().pipe(
        catchError((e: WorkspaceError) => e.status === 404 ? of(null) : throwError(() => e))),
      years: this.api.academicYears(),
      departments: this.api.departments(),
      programs: this.api.programs(),
      users: this.api.users({ size: 1 }),
      coordinators: this.api.users({ role: 'COORDINATOR', size: 1 }),
    }).subscribe({
      next: r => this.data.set({
        institution: r.institution,
        currentYear: r.years.find(y => y.isCurrent) ?? null,
        departments: r.departments,
        programs: r.programs,
        users: r.users.totalElements,
        coordinators: r.coordinators.totalElements,
      }),
      error: (e: WorkspaceError) => this.error.set(e.message),
    });
  }

  activeCount(list: { status: string }[]): number {
    return list.filter(x => x.status === 'ACTIVE').length;
  }

  programCount(programs: Program[], departmentId: string): number {
    return programs.filter(p => p.departmentId === departmentId && p.status === 'ACTIVE').length;
  }
}
