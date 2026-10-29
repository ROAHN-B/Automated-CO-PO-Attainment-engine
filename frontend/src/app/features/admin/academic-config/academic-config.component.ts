import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { AcademicYear, Department, Program } from '../../../core/models/admin.model';
import { AdminService } from '../../../core/services/admin.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';

/** Which add/edit dialog is open; the record is absent when adding. */
type Dialog =
  | { kind: 'year'; record?: AcademicYear }
  | { kind: 'department'; record?: Department }
  | { kind: 'program'; record?: Program };

/** Every field any of the three dialogs edits. */
interface DialogForm {
  name: string; startDate: string; endDate: string; yearStatus: AcademicYear['status'];
  code: string; departmentId: string; level: Program['programLevel'];
}

/**
 * Academic years, departments and programs (API_CONTRACT §6 ACAD-1 to ACAD-4,
 * §16 ADM-2 to ADM-4). Records are deactivated, never deleted. Semesters,
 * syllabi and courses belong to each department's coordinator (§15).
 */
@Component({
  selector: 'app-academic-config',
  standalone: true,
  imports: [FormsModule, IconComponent, BodyPortalDirective],
  templateUrl: './academic-config.component.html',
})
export class AcademicConfigComponent {
  private readonly api = inject(AdminService);

  readonly years = signal<AcademicYear[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly programs = signal<Program[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  /** Programs list filter; '' shows every department. */
  readonly programDepartment = signal('');
  readonly visiblePrograms = computed(() =>
    this.programs().filter(p => !this.programDepartment() || p.departmentId === this.programDepartment()));
  readonly activeDepartments = computed(() => this.departments().filter(d => d.status === 'ACTIVE'));

  readonly dialog = signal<Dialog | null>(null);
  form: DialogForm = this.blankForm();
  readonly saving = signal(false);
  readonly errors = signal<Record<string, string>>({});
  readonly dialogMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({ years: this.api.academicYears(), departments: this.api.departments(), programs: this.api.programs() }).subscribe({
      next: r => {
        this.years.set(r.years);
        this.departments.set(r.departments);
        this.programs.set(r.programs);
        this.loading.set(false);
      },
      error: (e: WorkspaceError) => { this.loadError.set(e.message); this.loading.set(false); },
    });
  }

  departmentCode(id: string): string {
    return this.departments().find(d => d.departmentId === id)?.departmentCode ?? '—';
  }

  /* ---- row actions ---- */

  makeCurrent(y: AcademicYear): void {
    this.run(y.academicYearId, this.api.makeCurrent(y.academicYearId), `${y.name} is now the current academic year.`);
  }

  setDepartmentStatus(d: Department, status: Department['status']): void {
    this.run(d.departmentId, this.api.updateDepartment(d.departmentId, { status }),
      `${d.departmentName} ${status === 'ACTIVE' ? 'reactivated' : 'deactivated'}.`);
  }

  setProgramStatus(p: Program, status: Program['status']): void {
    this.run(p.programId, this.api.updateProgram(p.programId, { status }),
      `${p.programName} ${status === 'ACTIVE' ? 'reactivated' : 'deactivated'}.`);
  }

  private run(id: string, req$: Observable<unknown>, message: string): void {
    this.busyId.set(id);
    this.actionError.set(null);
    req$.subscribe({
      next: () => { this.busyId.set(null); this.notice.set(message); this.load(); },
      error: (e: WorkspaceError) => { this.busyId.set(null); this.actionError.set(e.message); },
    });
  }

  /* ---- add / edit dialog ---- */

  open(dialog: Dialog): void {
    const f = this.blankForm();
    if (dialog.kind === 'year' && dialog.record) {
      const y = dialog.record;
      Object.assign(f, { name: y.name, startDate: y.startDate, endDate: y.endDate, yearStatus: y.status });
    }
    if (dialog.kind === 'department' && dialog.record) {
      Object.assign(f, { name: dialog.record.departmentName, code: dialog.record.departmentCode });
    }
    if (dialog.kind === 'program') {
      const p = dialog.record;
      Object.assign(f, p
        ? { name: p.programName, code: p.programCode, departmentId: p.departmentId, level: p.programLevel }
        : { departmentId: this.programDepartment() || this.activeDepartments()[0]?.departmentId || '' });
    }
    this.form = f;
    this.errors.set({});
    this.dialogMessage.set(null);
    this.dialog.set(dialog);
  }

  close(): void {
    if (!this.saving()) this.dialog.set(null);
  }

  save(): void {
    const d = this.dialog();
    if (!d) return;
    const f = this.form;
    let req$: Observable<unknown>;
    let done: string;
    switch (d.kind) {
      case 'year':
        req$ = d.record
          ? this.api.updateAcademicYear(d.record.academicYearId, { name: f.name.trim(), startDate: f.startDate, endDate: f.endDate, status: f.yearStatus })
          : this.api.createAcademicYear({ name: f.name.trim(), startDate: f.startDate, endDate: f.endDate });
        done = `Academic year ${f.name.trim()} ${d.record ? 'updated' : 'added'}.`;
        break;
      case 'department':
        req$ = d.record
          ? this.api.updateDepartment(d.record.departmentId, { departmentName: f.name })
          : this.api.createDepartment({ departmentCode: f.code, departmentName: f.name });
        done = `${f.name.trim()} ${d.record ? 'updated' : 'added'}.`;
        break;
      case 'program':
        req$ = d.record
          ? this.api.updateProgram(d.record.programId, { programName: f.name, programLevel: f.level })
          : this.api.createProgram({ departmentId: f.departmentId, programCode: f.code, programName: f.name, programLevel: f.level });
        done = `${f.name.trim()} ${d.record ? 'updated' : 'added'}.`;
        break;
    }
    this.saving.set(true);
    this.errors.set({});
    this.dialogMessage.set(null);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialog.set(null);
        this.notice.set(done);
        this.load();
      },
      error: (e: WorkspaceError) => {
        this.saving.set(false);
        // The server names fields by the contract (departmentName, programCode…); the form shares a few inputs.
        const fe = e.fieldErrors ?? {};
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(fe)) {
          mapped[{ departmentName: 'name', programName: 'name', departmentCode: 'code', programCode: 'code', status: 'yearStatus' }[k] ?? k] = v;
        }
        if (Object.keys(mapped).length) this.errors.set(mapped);
        else this.dialogMessage.set(e.message);
      },
    });
  }

  private blankForm(): DialogForm {
    return { name: '', startDate: '', endDate: '', yearStatus: 'ACTIVE', code: '', departmentId: '', level: 'UG' };
  }
}
