import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { Page } from '../../../core/models/common.model';
import { AdminUser, Department, ROLE_LABELS, SystemRole, UserStatus } from '../../../core/models/admin.model';
import { AdminService } from '../../../core/services/admin.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../shared/ui/icon.component';
import { UserFormDialogComponent } from './user-form-dialog.component';

/**
 * Users and roles (API_CONTRACT §16 ADM-12): Super Admin adds people and grants
 * roles, including COORDINATOR for one department. Faculty a coordinator adds
 * to their department (§15.3) show up here too.
 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [DatePipe, FormsModule, IconComponent, UserFormDialogComponent],
  template: `
    <div class="page space-y-6">
      <header class="page-header">
        <div>
          <p class="page-kicker">Administration</p>
          <h1 class="page-title">Users and roles</h1>
          <p class="page-subtitle">Everyone who can sign in. Make a faculty member their department’s coordinator here.</p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-primary" (click)="editing.set(null)">
            <app-icon name="plus" class="h-4 w-4" /> Add user
          </button>
        </div>
      </header>

      <div class="flex flex-wrap gap-3">
        <div class="field w-full sm:w-64">
          <label class="sr-only" for="us-search">Search users</label>
          <input id="us-search" type="search" class="field-input h-10" placeholder="Search by name, email or ID"
                 [(ngModel)]="search" (ngModelChange)="searchChanges.next()" />
        </div>
        <div class="field w-full sm:w-44">
          <label class="sr-only" for="us-role">Role</label>
          <select id="us-role" class="field-select h-10" [(ngModel)]="role" (ngModelChange)="filter()">
            <option value="">All roles</option>
            @for (r of roles; track r) { <option [value]="r">{{ roleLabels[r] }}</option> }
          </select>
        </div>
        <div class="field w-full sm:w-56">
          <label class="sr-only" for="us-dept">Department</label>
          <select id="us-dept" class="field-select h-10" [(ngModel)]="departmentId" (ngModelChange)="filter()">
            <option value="">All departments</option>
            @for (d of departments(); track d.departmentId) { <option [value]="d.departmentId">{{ d.departmentCode }} · {{ d.departmentName }}</option> }
          </select>
        </div>
        <div class="field w-full sm:w-40">
          <label class="sr-only" for="us-status">Account status</label>
          <select id="us-status" class="field-select h-10" [(ngModel)]="status" (ngModelChange)="filter()">
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="LOCKED">Locked</option>
          </select>
        </div>
      </div>

      @if (notice()) {
        <div class="alert alert-info" role="status">
          <app-icon name="check" class="mt-0.5 h-4 w-4" [stroke]="2" />
          <p class="flex-1">{{ notice() }}</p>
          <button type="button" class="btn btn-ghost btn-icon h-7 w-7" (click)="notice.set(null)" aria-label="Dismiss">
            <app-icon name="close" class="h-4 w-4" />
          </button>
        </div>
      }

      @if (loading() && !data()) {
        <div class="skeleton h-80" aria-busy="true" aria-label="Loading users"></div>
      } @else if (error()) {
        <div class="alert alert-error" role="alert">
          <app-icon name="alert" class="mt-0.5 h-4 w-4" />
          <div class="flex-1"><p class="font-semibold">Couldn’t load the users</p><p class="mt-0.5">{{ error() }}</p></div>
          <button type="button" class="btn btn-outline btn-sm" (click)="load()">Try again</button>
        </div>
      } @else if (data()) { @let p = data()!;
        <section class="card overflow-hidden" [class.opacity-60]="loading()" aria-label="Users">
          <div class="table-wrap">
            <table class="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th class="th" scope="col">Name</th>
                  <th class="th" scope="col">Department</th>
                  <th class="th" scope="col">Roles</th>
                  <th class="th" scope="col">Sign-in</th>
                  <th class="th" scope="col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (u of p.content; track u.userId) {
                  <tr [class.opacity-60]="u.status !== 'ACTIVE'">
                    <td class="td">
                      <p class="flex items-center gap-2 font-medium text-ink">
                        {{ u.fullName }}
                        @if (u.status !== 'ACTIVE') { <span class="chip chip-neutral text-ink-muted">{{ statusLabels[u.status] }}</span> }
                      </p>
                      <p class="text-[13px] text-ink-muted">{{ u.email }}@if (u.userCode) { · <span class="font-mono">{{ u.userCode }}</span> }</p>
                    </td>
                    <td class="td">{{ u.departmentName ?? '—' }}</td>
                    <td class="td">
                      <div class="flex flex-wrap gap-1">
                        @for (r of u.roles; track r) {
                          <span class="chip" [class.chip-brand]="r === u.primaryRole" [class.chip-neutral]="r !== u.primaryRole"
                                [attr.title]="r === u.primaryRole ? 'Primary role' : null">
                            {{ roleLabels[r] }}@if (r === 'COORDINATOR' && u.coordinatorDepartmentId) { · {{ departmentCode(u.coordinatorDepartmentId) }} }
                          </span>
                        }
                      </div>
                    </td>
                    <td class="td whitespace-nowrap text-[13px]">
                      @if (!u.hasPassword) { <span class="text-ink-muted">Invitation pending</span> }
                      @else if (u.lastLoginAt) { Last {{ u.lastLoginAt | date: 'd MMM y' }} }
                      @else { <span class="text-ink-muted">Never signed in</span> }
                    </td>
                    <td class="td text-right">
                      <button type="button" class="btn btn-ghost btn-sm" (click)="editing.set(u)" [attr.aria-label]="'Edit ' + u.fullName">Edit</button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td class="td py-10 text-center text-ink-muted" colspan="5">No users match these filters.</td></tr>
                }
              </tbody>
            </table>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[13px] text-ink-muted">
            <span>{{ p.totalElements }} {{ p.totalElements === 1 ? 'user' : 'users' }}</span>
            @if (p.totalPages > 1) {
              <span class="flex items-center gap-2">
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="p.page === 0" (click)="goToPage(p.page - 1)">Previous</button>
                <span class="tnum">Page {{ p.page + 1 }} of {{ p.totalPages }}</span>
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="p.page + 1 >= p.totalPages" (click)="goToPage(p.page + 1)">Next</button>
              </span>
            }
          </div>
        </section>
      }
    </div>

    @if (editing() !== undefined) {
      <app-user-form-dialog [user]="editing() ?? null" [departments]="departments()"
                            (saved)="onSaved($event, !!editing())" (closed)="editing.set(undefined)" />
    }
  `,
})
export class UsersComponent {
  private readonly api = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roles: SystemRole[] = ['FACULTY', 'COORDINATOR', 'HOD', 'SUPER_ADMIN'];
  readonly roleLabels = ROLE_LABELS;
  readonly statusLabels: Record<UserStatus, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', SUSPENDED: 'Suspended', LOCKED: 'Locked' };
  readonly pageSize = 20;

  readonly data = signal<Page<AdminUser> | null>(null);
  readonly departments = signal<Department[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  /** null for "add", a user for "edit", undefined when closed. */
  readonly editing = signal<AdminUser | null | undefined>(undefined);

  search = '';
  role: SystemRole | '' = '';
  departmentId = '';
  status: UserStatus | '' = '';
  private readonly pageIndex = signal(0);
  readonly searchChanges = new Subject<void>();

  constructor() {
    this.searchChanges.pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.filter());
    this.api.departments().subscribe({ next: d => this.departments.set(d), error: () => {} });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.users({
      q: this.search.trim() || undefined, role: this.role || undefined, departmentId: this.departmentId || undefined,
      status: this.status || undefined, page: this.pageIndex(), size: this.pageSize,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => { this.data.set(p); this.loading.set(false); },
      error: (e: WorkspaceError) => { this.error.set(e.message); this.loading.set(false); },
    });
  }

  filter(): void {
    this.pageIndex.set(0);
    this.load();
  }

  goToPage(n: number): void {
    this.pageIndex.set(n);
    this.load();
  }

  departmentCode(id: string): string {
    return this.departments().find(d => d.departmentId === id)?.departmentCode ?? '';
  }

  onSaved(u: AdminUser, wasEdit: boolean): void {
    this.editing.set(undefined);
    this.notice.set(wasEdit ? `${u.fullName} updated.` : `${u.fullName} added.`);
    this.load();
  }
}
