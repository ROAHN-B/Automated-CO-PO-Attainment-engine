import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StepState } from '../../../core/models/faculty-workspace.model';
import { IconComponent } from '../../../shared/ui/icon.component';
import { STEP_LABELS, STEP_PURPOSE, stepKeyFromParam } from '../lifecycle';
import { CourseContext } from './course-context';

/**
 * Landing screen for a lifecycle step whose full editor isn't built yet
 * (plan, CAM, paper validation, marksheet, marks review, surveys, submission).
 * It shows the step's real state from the backend, so locks behave correctly.
 */
@Component({
  selector: 'app-course-step',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    @if (key(); as k) {
      <div class="space-y-6 animate-enter">
        <header>
          <p class="page-kicker">{{ assessmentName() ?? 'Course setup' }}</p>
          <h2 class="mt-1.5 font-serif text-[32px] font-light leading-tight text-ink">{{ labels[k] }}</h2>
          <p class="mt-2 max-w-2xl text-[15px] text-ink-soft">{{ purposes[k] }}</p>
        </header>

        @if (state(); as s) {
          @switch (s.status) {
            @case ('LOCKED') {
              <div class="alert alert-info">
                <app-icon name="lock" class="mt-0.5 h-4 w-4" />
                <div><p class="font-semibold text-ink">This step is locked</p><p class="mt-0.5">{{ s.lockedReason }}</p></div>
              </div>
            }
            @case ('DONE') {
              <div class="alert alert-success">
                <app-icon name="check" class="mt-0.5 h-4 w-4" [stroke]="2" />
                <p>This step is complete.</p>
              </div>
            }
            @default {
              <div class="alert alert-info">
                <app-icon name="clock" class="mt-0.5 h-4 w-4" />
                <p>{{ k === 'MARKS_UPLOAD' ? 'Waiting for the lab assistant to upload the filled marksheet. You’ll be notified when it arrives.' : 'This step is open.' }}</p>
              </div>
            }
          }
        }

        <div class="card card-body text-sm text-ink-muted">
          The full {{ labels[k].toLowerCase() }} screen is designed in the next iteration. Its data contract is in
          <span class="font-mono text-[13px] text-ink-soft">API_CONTRACT.md</span>.
          <a routerLink="../.." class="link-accent ml-1">Back to overview</a>
        </div>
      </div>
    } @else {
      <div class="card empty-state"><p class="empty-title">Unknown step</p><a routerLink="../.." class="link-accent">Back to overview</a></div>
    }
  `,
})
export class CourseStepComponent {
  private readonly ctx = inject(CourseContext);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap);
  private readonly query = toSignal(this.route.queryParamMap);

  readonly labels = STEP_LABELS;
  readonly purposes = STEP_PURPOSE;
  readonly key = computed(() => stepKeyFromParam(this.params()?.get('stepKey') ?? null));

  private readonly cycle = computed(() => {
    const id = this.query()?.get('assessment');
    return id ? this.ctx.offering()?.progress.cycles.find(c => c.assessmentId === id) ?? null : null;
  });
  readonly assessmentName = computed(() => this.cycle()?.name ?? null);

  readonly state = computed<StepState | null>(() => {
    const p = this.ctx.offering()?.progress;
    const k = this.key();
    if (!p || !k) return null;
    const c = this.cycle();
    switch (k) {
      case 'SUBJECT_SELECTION': return p.setup.subjectSelection;
      case 'ASSESSMENT_PLAN': return p.setup.assessmentPlan;
      case 'CAM': return p.setup.cam;
      case 'PAPER_VALIDATION': return c?.steps.paperValidation ?? null;
      case 'MARKSHEET': return c?.steps.marksheet ?? null;
      case 'MARKS_UPLOAD': return c?.steps.marksUpload ?? null;
      case 'MARKS_APPROVAL': return c?.steps.marksApproval ?? null;
      case 'ATTAINMENT_APPROVAL': return c?.steps.attainmentApproval ?? null;
      case 'INDIRECT_SURVEYS': return p.closeOut.indirectSurveys;
      case 'FINAL_ATTAINMENT': return p.closeOut.finalAttainment;
      case 'SUBMISSION': return p.closeOut.submission;
    }
  });
}
