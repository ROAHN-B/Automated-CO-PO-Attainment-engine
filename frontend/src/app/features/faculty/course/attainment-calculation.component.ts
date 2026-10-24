import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AttainmentReadiness, AttainmentRun, CoAttainmentResult, PendingReason, PhaseAttainment, PhaseCriteria, StudentCoScore,
} from '../../../core/models/faculty-workspace.model';
import { FacultyWorkspaceService, WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../shared/ui/icon.component';
import { LevelMeterComponent } from '../../../shared/ui/level-meter/level-meter.component';
import { CourseContext } from './course-context';

type View = 'LOADING' | 'ERROR' | 'NOTHING' | 'READY' | 'CALCULATING' | 'CALCULATED' | 'APPROVED';

/**
 * CO-PO attainment calculation (API_CONTRACT §14.2): read-only inputs →
 * calculate on the server → every step of the working → approve (writes the
 * workbook and unlocks the next cycle) or discard.
 *
 * All numbers shown are the backend's. The page lays them out as equations but
 * never computes a level, direct, overall or PO value itself.
 */
@Component({
  selector: 'app-attainment-calculation',
  standalone: true,
  imports: [DecimalPipe, RouterLink, IconComponent, LevelMeterComponent],
  templateUrl: './attainment-calculation.component.html',
})
export class AttainmentCalculationComponent {
  private readonly api = inject(FacultyWorkspaceService);
  readonly ctx = inject(CourseContext);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly view = signal<View>('LOADING');
  readonly error = signal<WorkspaceError | null>(null);
  readonly actionError = signal<string>('');
  readonly readiness = signal<AttainmentReadiness | null>(null);
  readonly run = signal<AttainmentRun | null>(null);
  readonly confirming = signal<'APPROVE' | 'DISCARD' | null>(null);
  readonly busy = signal(false);
  readonly expanded = signal<Record<string, boolean>>({});

  readonly studentsFor = signal<CoAttainmentResult | null>(null);
  readonly students = signal<StudentCoScore[] | null>(null);

  private upTo: string | undefined;
  private isFinal = false;

  /** The ESE criteria that apply to this course's scheme. */
  readonly eseCriteria = computed<PhaseCriteria | null>(() => {
    const t = this.readiness()?.inputs.targets ?? this.run()?.targets;
    if (!t) return null;
    return (this.ctx.offering()?.assessmentScheme ?? 'THEORY') === 'THEORY' ? t.ese.theory : t.ese.practical;
  });
  readonly targets = computed(() => this.run()?.targets ?? this.readiness()?.inputs.targets ?? null);
  readonly scope = computed(() => this.run()?.scope ?? this.readiness()?.scope ?? null);
  readonly hasEse = computed(() => this.scope()?.includedAssessments.some(a => a.phase === 'ESE') ?? false);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(q => {
      this.upTo = q.get('upTo') ?? undefined;
      this.isFinal = q.get('final') === '1';
      this.load();
    });
  }

  load(): void {
    this.view.set('LOADING');
    this.error.set(null);
    this.run.set(null);
    const id = this.ctx.offeringId();
    forkJoin({ readiness: this.api.readiness(id, this.upTo), preview: this.api.currentPreview(id) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ readiness, preview }) => {
          this.readiness.set(readiness);
          if (preview) { this.run.set(preview); this.view.set('CALCULATED'); }
          else this.view.set('READY');
        },
        error: (e: WorkspaceError) => {
          this.error.set(e);
          this.view.set(e.status === 409 || e.status === 422 ? 'NOTHING' : 'ERROR');
        },
      });
  }

  calculate(): void {
    this.actionError.set('');
    this.view.set('CALCULATING');
    this.api.calculate(this.ctx.offeringId(), { upToAssessmentId: this.upTo, final: this.isFinal || undefined })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => {
          this.run.set(r);
          this.view.set('CALCULATED');
          // Open the first CO's working so the "how" is visible straight away.
          if (r.coResults[0]) this.expanded.set({ [r.coResults[0].coId]: true });
        },
        error: (e: WorkspaceError) => { this.actionError.set(e.message); this.view.set('READY'); },
      });
  }

  confirm(): void {
    const r = this.run();
    const action = this.confirming();
    if (!r || !action) return;
    this.busy.set(true);
    this.actionError.set('');
    const call = action === 'APPROVE' ? this.api.approve(r) : this.api.discard(r.runId);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.busy.set(false);
        this.confirming.set(null);
        if (action === 'APPROVE') {
          this.run.set(updated);
          this.view.set('APPROVED');
        } else {
          this.run.set(null);
          this.view.set('READY');
        }
        this.ctx.refresh(); // locks and next action changed
      },
      error: (e: WorkspaceError) => { this.busy.set(false); this.actionError.set(e.message); this.confirming.set(null); },
    });
  }

  toggle(coId: string): void {
    this.expanded.update(m => ({ ...m, [coId]: !m[coId] }));
  }

  openStudents(co: CoAttainmentResult): void {
    const r = this.run();
    if (!r) return;
    this.studentsFor.set(co);
    this.students.set(null);
    this.api.runStudents(r.runId, co.coId).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(s => this.students.set(s));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.busy()) this.confirming.set(null);
    this.studentsFor.set(null);
  }

  /* ---- view helpers (presentation only) ---- */

  pendingText(reason?: PendingReason | null): string {
    return reason === 'AWAITING_ESE' ? 'Pending ESE'
      : reason === 'AWAITING_INDIRECT' ? 'Pending surveys'
      : 'Pending';
  }

  /** Which threshold the backend's level corresponds to — for highlighting only. */
  isAppliedLevel(p: PhaseAttainment, n: 1 | 2 | 3): boolean {
    return p.level === n;
  }

  surveyEntries(co: CoAttainmentResult): { label: string; value: number }[] {
    const s = co.indirect;
    return [
      { label: 'Course exit survey', value: s.courseExitSurvey },
      { label: 'Examiner survey', value: s.examinerSurvey },
      { label: 'Additional survey', value: s.additionalSurvey },
    ].filter((x): x is { label: string; value: number } => typeof x.value === 'number');
  }

  surveyValues(co: CoAttainmentResult): string {
    return this.surveyEntries(co).map(s => s.value).join(', ');
  }

  surveyLabels(co: CoAttainmentResult): string {
    return this.surveyEntries(co).map(s => s.label).join(' · ');
  }

  checkLabel(code: string): string {
    return ({
      ASSESSMENT_PLAN_FINALIZED: 'Assessment plan finalized',
      CAM_FINALIZED: 'CAM finalized',
      QUESTION_CO_MAPPING: 'Every question mapped to a CO',
      VALIDATED_MARKS: 'Marks approved',
      TARGETS_CONFIGURED: 'Criteria configured',
      INDIRECT_SURVEYS: 'Indirect surveys entered',
      STAGE_ORDER: 'Previous steps complete',
    } as Record<string, string>)[code] ?? code;
  }
}
