import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AssessmentPlan } from '../../../core/models/faculty-workspace.model';
import { FacultyWorkspaceService, WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../shared/ui/icon.component';
import { STEP_PURPOSE, categoryLabel } from '../lifecycle';
import { CourseContext } from './course-context';

/**
 * Setup step 1, Accept allocation (API_CONTRACT §7.2 FAC-4): the subject the
 * coordinator allocated, and how it's assessed (a read-only preview of the
 * generated plan, PLAN-1). Accepting unlocks the assessment plan.
 */
@Component({
  selector: 'app-accept-allocation',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    @if (ctx.offering(); as o) {
      <div class="space-y-6 animate-enter">
        <header>
          <p class="page-kicker">Course setup</p>
          <h2 class="mt-1.5 font-serif text-[32px] font-light leading-tight text-ink">Accept allocation</h2>
          <p class="mt-2 max-w-2xl text-[15px] text-ink-soft">{{ purpose }}</p>
        </header>

        <section class="card" aria-labelledby="aa-subject">
          <div class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
            <div>
              <h3 id="aa-subject" class="font-serif text-2xl font-light text-ink">{{ o.course.courseName }}</h3>
              <p class="mt-1 font-mono text-[13px] text-ink-muted">{{ o.course.courseCode }}</p>
            </div>
            @if (o.allocation.status === 'ACCEPTED') {
              <span class="chip chip-neutral"><app-icon name="check" class="h-3 w-3" [stroke]="2.5" /> Accepted {{ o.allocation.acceptedAt | date: 'd MMM y' }}</span>
            } @else {
              <span class="chip chip-brand">Awaiting your acceptance</span>
            }
          </div>
          <dl class="grid gap-x-8 gap-y-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt class="stat-label">Semester</dt><dd class="mt-1 text-sm text-ink">Semester {{ o.semester.semesterNumber }} · {{ o.academicYear.name }}</dd></div>
            <div><dt class="stat-label">Class</dt><dd class="mt-1 text-sm text-ink">{{ o.className }}{{ o.division ? ' · Division ' + o.division : '' }}</dd></div>
            <div><dt class="stat-label">Allocated by</dt><dd class="mt-1 text-sm text-ink">{{ o.allocation.allocatedBy }}{{ o.allocation.notifiedAt ? ', ' : '' }}{{ o.allocation.notifiedAt | date: 'd MMM y' }}</dd></div>
          </dl>
        </section>

        <!-- How the subject is assessed, from the coordinator's load distribution -->
        <section class="card" aria-labelledby="aa-assessed">
          <div class="border-b border-line px-6 py-4">
            <h3 id="aa-assessed" class="text-[15px] font-semibold text-ink">How it’s assessed</h3>
            <p class="mt-0.5 text-sm text-ink-muted">Set by your coordinator in the syllabus load distribution.</p>
          </div>
          @if (plan(); as p) {
            <dl class="flex flex-wrap gap-x-8 gap-y-3 px-6 py-4">
              @for (c of p.examinationScheme.components; track c.type) {
                <div><dt class="stat-label">{{ c.type === 'OE_POE' ? 'OE/POE' : c.type }}</dt><dd class="mt-1 font-serif text-2xl font-light text-ink tnum">{{ c.maxMarks }}</dd></div>
              }
            </dl>
            <ul class="border-t border-line-soft px-6 py-4 text-sm text-ink-soft">
              @for (g of groups(); track g.label) {
                <li>{{ g.count }} × {{ g.label }} of {{ g.marks }} marks</li>
              }
            </ul>
          } @else if (planError()) {
            <p class="px-6 py-4 text-sm text-ink-muted">{{ planError() }}</p>
          } @else {
            <div class="skeleton m-6 h-16" aria-busy="true"></div>
          }
        </section>

        @if (error()) {
          <div class="alert alert-error" role="alert">
            <app-icon name="alert" class="mt-0.5 h-4 w-4" />
            <p class="flex-1">{{ error() }}</p>
          </div>
        }

        <div class="flex flex-wrap items-center justify-between gap-3">
          @if (o.allocation.status === 'ACCEPTED') {
            <p class="text-sm text-ink-muted">Your coordinator can see that you’ve accepted this subject.</p>
            <a class="btn btn-primary" routerLink="../assessment_plan">Next: Assessment plan <app-icon name="arrowRight" class="h-4 w-4" /></a>
          } @else {
            <p class="max-w-xl text-sm text-ink-muted">If this allocation is wrong, tell your coordinator; they can give the subject to someone else.</p>
            <button type="button" class="btn btn-primary" (click)="accept()" [disabled]="busy()">
              @if (busy()) { <span class="spinner"></span> Accepting… } @else { Accept allocation }
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class AcceptAllocationComponent {
  readonly ctx = inject(CourseContext);
  private readonly api = inject(FacultyWorkspaceService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly purpose = STEP_PURPOSE.SUBJECT_SELECTION;
  readonly plan = signal<AssessmentPlan | null>(null);
  readonly planError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  /** "2 × In-semester exam of 15 marks" — grouped for reading, not recalculated. */
  readonly groups = computed(() => {
    const out: { label: string; count: number; marks: number }[] = [];
    for (const a of this.plan()?.assessments ?? []) {
      const label = categoryLabel(a.category);
      const g = out.find(x => x.label === label && x.marks === a.maxMarks);
      if (g) g.count++; else out.push({ label, count: 1, marks: a.maxMarks });
    }
    return out;
  });

  constructor() {
    this.api.assessmentPlan(this.ctx.offeringId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => this.plan.set(p),
      error: (e: WorkspaceError) => this.planError.set(e.message),
    });
  }

  accept(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.acceptAllocation(this.ctx.offeringId()).subscribe({
      next: () => {
        this.busy.set(false);
        this.ctx.refresh();
        this.router.navigate(['../assessment_plan'], { relativeTo: this.route });
      },
      error: (e: WorkspaceError) => { this.busy.set(false); this.error.set(e.message); },
    });
  }
}
