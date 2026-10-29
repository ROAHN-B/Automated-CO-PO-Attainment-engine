import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import { AdminUser, Department, ROLE_LABELS, SystemRole, UserStatus } from '../../../core/models/admin.model';
import { AdminService } from '../../../core/services/admin.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';

/**
 * Add a user, or edit one and their roles (API_CONTRACT §16 ADM-12). The server
 * checks every rule (college email, a coordinator also holds Faculty and names
 * the department they coordinate…); its messages appear next to the fields.
 */
@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [FormsModule, IconComponent, BodyPortalDirective],
  template: `
    <div class="modal-backdrop" appBodyPortal (click)="close()">
      <form class="modal max-w-xl" role="dialog" aria-modal="true" aria-labelledby="uf-title"
            (click)="$event.stopPropagation()" (ngSubmit)="save()" novalidate>
        <div class="max-h-[75vh] space-y-5 overflow-y-auto p-6">
          <div>
            <h3 id="uf-title" class="font-serif text-2xl font-light text-ink">{{ user() ? 'Edit ' + user()!.fullName : 'Add a user' }}</h3>
            <p class="mt-1.5 text-sm text-ink-soft">
              {{ user() ? 'Role changes apply the next time they open the app.' : 'They set their own password from the invitation email.' }}
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            @for (f of textFields; track f.key) {
              <div class="field">
                <label class="field-label" [for]="'uf-' + f.key">{{ f.label }}</label>
                <input [id]="'uf-' + f.key" [name]="f.key" class="field-input" [class.field-invalid]="errors()[f.key]"
                       [(ngModel)]="form[f.key]" autocomplete="off" [attr.placeholder]="f.placeholder ?? null"
                       [attr.aria-invalid]="!!errors()[f.key]" [attr.aria-describedby]="errors()[f.key] ? 'uf-' + f.key + '-err' : null" />
                @if (errors()[f.key]) { <p class="field-error" [id]="'uf-' + f.key + '-err'">{{ errors()[f.key] }}</p> }
              </div>
            }
          </div>

          <div class="field">
            <label class="field-label" for="uf-email">College email</label>
            @if (user()) {
              <p id="uf-email" class="text-sm text-ink">{{ user()!.email }}</p>
            } @else {
              <input id="uf-email" name="email" type="email" class="field-input" [class.field-invalid]="errors()['email']"
                     [(ngModel)]="form.email" placeholder="name@wit.edu" autocomplete="off"
                     [attr.aria-invalid]="!!errors()['email']" [attr.aria-describedby]="errors()['email'] ? 'uf-email-err' : 'uf-email-help'" />
              @if (errors()['email']) { <p class="field-error" id="uf-email-err">{{ errors()['email'] }}</p> }
              @else { <p class="field-help" id="uf-email-help">Their sign-in name. It can’t be changed later.</p> }
            }
          </div>

          <div class="field">
            <label class="field-label" for="uf-dept">Department</label>
            <select id="uf-dept" name="departmentId" class="field-select" [class.field-invalid]="errors()['departmentId']" [(ngModel)]="form.departmentId"
                    [attr.aria-invalid]="!!errors()['departmentId']" [attr.aria-describedby]="errors()['departmentId'] ? 'uf-dept-err' : null">
              <option value="">No department (Super Admin only)</option>
              @for (d of activeDepartments(); track d.departmentId) { <option [value]="d.departmentId">{{ d.departmentCode }} · {{ d.departmentName }}</option> }
            </select>
            @if (errors()['departmentId']) { <p class="field-error" id="uf-dept-err">{{ errors()['departmentId'] }}</p> }
          </div>

          <fieldset class="space-y-2" [attr.aria-describedby]="errors()['roles'] ? 'uf-roles-err' : null">
            <legend class="field-label">Roles</legend>
            <div class="grid gap-2 text-sm text-ink sm:grid-cols-2">
              @for (r of allRoles; track r) {
                <label class="flex items-center gap-2.5">
                  <input type="checkbox" [name]="'role-' + r" [ngModel]="form.roles.includes(r)" (ngModelChange)="toggleRole(r, $event)" />
                  {{ roleLabels[r] }}
                </label>
              }
            </div>
            @if (errors()['roles']) { <p class="field-error" id="uf-roles-err">{{ errors()['roles'] }}</p> }
          </fieldset>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="field">
              <label class="field-label" for="uf-primary">Primary role</label>
              <select id="uf-primary" name="primaryRole" class="field-select" [class.field-invalid]="errors()['primaryRole']" [(ngModel)]="form.primaryRole"
                      [attr.aria-invalid]="!!errors()['primaryRole']" [attr.aria-describedby]="errors()['primaryRole'] ? 'uf-primary-err' : 'uf-primary-help'">
                @for (r of form.roles; track r) { <option [value]="r">{{ roleLabels[r] }}</option> }
              </select>
              @if (errors()['primaryRole']) { <p class="field-error" id="uf-primary-err">{{ errors()['primaryRole'] }}</p> }
              @else { <p class="field-help" id="uf-primary-help">Decides where they land after signing in.</p> }
            </div>
            @if (form.roles.includes('COORDINATOR')) {
              <div class="field">
                <label class="field-label" for="uf-coord">Coordinates</label>
                <select id="uf-coord" name="coordinatorDepartmentId" class="field-select" [class.field-invalid]="errors()['coordinatorDepartmentId']"
                        [(ngModel)]="form.coordinatorDepartmentId"
                        [attr.aria-invalid]="!!errors()['coordinatorDepartmentId']" [attr.aria-describedby]="errors()['coordinatorDepartmentId'] ? 'uf-coord-err' : null">
                  <option value="">Choose a department</option>
                  @for (d of activeDepartments(); track d.departmentId) { <option [value]="d.departmentId">{{ d.departmentCode }} · {{ d.departmentName }}</option> }
                </select>
                @if (errors()['coordinatorDepartmentId']) { <p class="field-error" id="uf-coord-err">{{ errors()['coordinatorDepartmentId'] }}</p> }
              </div>
            }
          </div>

          @if (user()) {
            <div class="field max-w-xs">
              <label class="field-label" for="uf-status">Account</label>
              <select id="uf-status" name="status" class="field-select" [class.field-invalid]="errors()['status']" [(ngModel)]="form.status"
                      [attr.aria-invalid]="!!errors()['status']">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="LOCKED">Locked</option>
              </select>
            </div>
          }

          @if (message()) {
            <div class="alert alert-error" role="alert">
              <app-icon name="alert" class="mt-0.5 h-4 w-4" />
              <p>{{ message() }}</p>
            </div>
          }
        </div>
        <div class="flex justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" class="btn btn-ghost" [disabled]="saving()" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> Saving… } @else { {{ user() ? 'Save changes' : 'Add user' }} }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class UserFormDialogComponent implements OnInit {
  private readonly api = inject(AdminService);

  /** The user to edit; absent to add one. */
  readonly user = input<AdminUser | null>(null);
  readonly departments = input<Department[]>([]);
  readonly saved = output<AdminUser>();
  readonly closed = output<void>();

  readonly activeDepartments = computed(() => this.departments().filter(d => d.status === 'ACTIVE'));
  readonly allRoles: SystemRole[] = ['FACULTY', 'COORDINATOR', 'HOD', 'SUPER_ADMIN'];
  readonly roleLabels = ROLE_LABELS;
  readonly textFields: { key: 'firstName' | 'lastName' | 'userCode' | 'phone'; label: string; placeholder?: string }[] = [
    { key: 'firstName', label: 'First name' },
    { key: 'lastName', label: 'Last name' },
    { key: 'userCode', label: 'Employee ID', placeholder: 'Optional' },
    { key: 'phone', label: 'Phone number', placeholder: 'Optional' },
  ];

  form = {
    firstName: '', lastName: '', userCode: '', phone: '', email: '', departmentId: '',
    roles: ['FACULTY'] as SystemRole[], primaryRole: 'FACULTY' as SystemRole, coordinatorDepartmentId: '', status: 'ACTIVE' as UserStatus,
  };
  readonly saving = signal(false);
  readonly errors = signal<Record<string, string>>({});
  readonly message = signal<string | null>(null);

  ngOnInit(): void {
    const u = this.user();
    if (u) {
      this.form = {
        firstName: u.firstName, lastName: u.lastName, userCode: u.userCode ?? '', phone: u.phone ?? '', email: u.email,
        departmentId: u.departmentId ?? '', roles: [...u.roles], primaryRole: u.primaryRole,
        coordinatorDepartmentId: u.coordinatorDepartmentId ?? '', status: u.status,
      };
    }
  }

  toggleRole(role: SystemRole, on: boolean): void {
    const roles = on ? [...this.form.roles, role] : this.form.roles.filter(r => r !== role);
    // A coordinator always holds Faculty too (API_CONTRACT §4.1).
    if (on && role === 'COORDINATOR' && !roles.includes('FACULTY')) roles.push('FACULTY');
    if (on && role === 'COORDINATOR' && !this.form.coordinatorDepartmentId) this.form.coordinatorDepartmentId = this.form.departmentId;
    this.form.roles = this.allRoles.filter(r => roles.includes(r));
    if (!this.form.roles.includes(this.form.primaryRole)) this.form.primaryRole = this.form.roles[0];
  }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }

  save(): void {
    const u = this.user();
    const f = this.form;
    const roles = { roles: f.roles, primaryRole: f.primaryRole, coordinatorDepartmentId: f.coordinatorDepartmentId || undefined };
    let req$: Observable<AdminUser>;
    if (!u) {
      req$ = this.api.createUser({
        firstName: f.firstName, lastName: f.lastName, email: f.email, userCode: f.userCode || undefined, phone: f.phone || undefined,
        departmentId: f.departmentId || undefined, ...roles,
      });
    } else {
      const rolesChanged = f.primaryRole !== u.primaryRole || [...f.roles].sort().join() !== [...u.roles].sort().join()
        || (f.coordinatorDepartmentId || undefined) !== u.coordinatorDepartmentId;
      // Details first, so a new department is in place before roles that need it are checked.
      req$ = this.api.updateUser(u.userId, {
        firstName: f.firstName, lastName: f.lastName, userCode: f.userCode, phone: f.phone, departmentId: f.departmentId, status: f.status,
      }).pipe(switchMap(updated => rolesChanged ? this.api.setRoles(u.userId, roles) : of(updated)));
    }
    this.saving.set(true);
    this.errors.set({});
    this.message.set(null);
    req$.subscribe({
      next: saved => { this.saving.set(false); this.saved.emit(saved); },
      error: (e: WorkspaceError) => {
        this.saving.set(false);
        if (e.fieldErrors) this.errors.set(e.fieldErrors);
        else this.message.set(e.message);
      },
    });
  }
}
