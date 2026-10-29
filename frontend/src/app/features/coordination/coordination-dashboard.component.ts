import { NgClass } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AcademicYearOption, CoordinatorOverview, SemesterSetupSummary } from '../../core/models/coordination.model';
import { CoordinationService } from '../../core/services/coordination.service';
import { WorkspaceError } from '../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../shared/ui/body-portal.directive';
import { IconComponent } from '../../shared/ui/icon.component';
import { SETUP_STEP_LABELS, SETUP_STEP_ORDER, roman, stepNumber, termOf, yearOfStudy } from './setup-steps';

/**
 * Coordinator dashboard (API_CONTRACT §15.1, CRD-12). One row per semester,
 * III to VIII, with its setup status and the next step; every count and
 * status comes from the backend. Creating a semester setup is CRD-13.
 */
@Component({
  selector: 'app-coordination-dashboard',
  standalone: true,
  imports: [NgClass, FormsModule, RouterLink, IconComponent, BodyPortalDirective],
  templateUrl: './coordination-dashboard.component.html',
})
export class CoordinationDashboardComponent {
  private readonly api = inject(CoordinationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly years = signal<AcademicYearOption[]>([]);
  readonly yearId = signal<string | null>(null);
  readonly data = signal<CoordinatorOverview | null>(null);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);

  /* ---- create dialog ---- */
  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly createError = signal<string | null>(null);
  newSemester: number | null = null;
  hasDivisions = false;
  divisionsText = 'A, B';

  readonly stepLabels = SETUP_STEP_LABELS;
  readonly totalSteps = SETUP_STEP_ORDER.length;
  roman = roman;
  yearOfStudy = yearOfStudy;
  termOf = termOf;

  /** Semesters still without a setup, for the create dialog. */
  readonly openSemesters = computed(() => this.data()?.semesters.filter(s => !s.setup).map(s => s.semesterNumber) ?? []);

  /** Year-wide sums of the backend's per-semester counts. */
  readonly totals = computed(() => {
    const setups = (this.data()?.semesters ?? []).map(s => s.setup).filter((s): s is SemesterSetupSummary => !!s);
    return {
      started: setups.length,
      completed: setups.filter(s => s.status === 'COMPLETED').length,
      configured: setups.reduce((n, s) => n + s.subjects.configured, 0),
      assigned: setups.reduce((n, s) => n + s.subjects.assigned, 0),
      accepted: setups.reduce((n, s) => n + s.subjects.accepted, 0),
    };
  });

  /** The earliest semester still in progress: the dashboard's primary action. */
  readonly next = computed(() => {
    const s = this.data()?.semesters.find(x => x.setup && x.setup.status !== 'COMPLETED');
    return s?.setup ? { semesterNumber: s.semesterNumber, setup: s.setup } : null;
  });

  constructor() {
    this.api.academicYears().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ys => {
        this.years.set(ys);
        const wanted = this.route.snapshot.queryParamMap.get('year');
        this.yearId.set(ys.find(y => y.academicYearId === wanted)?.academicYearId ?? ys.find(y => y.isCurrent)?.academicYearId ?? ys[0]?.academicYearId ?? null);
        this.load();
      },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.overview(this.yearId() ?? undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  changeYear(id: string): void {
    this.yearId.set(id);
    this.router.navigate([], { relativeTo: this.route, queryParams: { year: id }, replaceUrl: true });
    this.load();
  }

  /* ---- view helpers (presentation only) ---- */

  stepIndex(s: SemesterSetupSummary): number {
    return s.status === 'COMPLETED' ? this.totalSteps : stepNumber(s.currentStep);
  }

  segments(s: SemesterSetupSummary): ('done' | 'current' | 'todo')[] {
    const at = this.stepIndex(s);
    return SETUP_STEP_ORDER.map((_, i) =>
      s.status === 'COMPLETED' || i + 1 < at ? 'done' : i + 1 === at ? 'current' : 'todo');
  }

  /* ---- create a semester setup (CRD-13) ---- */

  openCreate(semesterNumber?: number): void {
    this.newSemester = semesterNumber ?? this.openSemesters()[0] ?? null;
    this.hasDivisions = false;
    this.divisionsText = 'A, B';
    this.createError.set(null);
    this.creating.set(true);
  }

  closeCreate(): void {
    if (!this.saving()) this.creating.set(false);
  }

  create(): void {
    const yearId = this.yearId();
    if (!yearId || this.newSemester == null) return;
    this.saving.set(true);
    this.createError.set(null);
    this.api.createSetup({
      academicYearId: yearId,
      semesterNumber: Number(this.newSemester),
      divisions: this.hasDivisions ? this.divisionsText.split(',') : [],
    }).subscribe({
      next: s => {
        this.saving.set(false);
        this.creating.set(false);
        this.router.navigate([s.setupId], { relativeTo: this.route });
      },
      error: (e: WorkspaceError) => { this.saving.set(false); this.createError.set(e.message); },
    });
  }
}
