import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StepState } from '../../../core/models/faculty-workspace.model';
import { IconComponent } from '../../../shared/ui/icon.component';
import { STEP_LABELS, STEP_PURPOSE, categoryLabel, nextActionLink } from '../lifecycle';
import { CourseContext } from './course-context';

/** Course overview: the single next step, then every assessment cycle at a glance. */
@Component({
  selector: 'app-course-overview',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, IconComponent],
  template: `
    @if (ctx.offering(); as o) {
      <div class="space-y-8 animate-enter">

        <!-- Next step -->
        @if (o.progress.nextAction; as n) {
          <section class="card overflow-hidden" aria-labelledby="next-title">
            <div class="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="page-kicker">Your next step</p>
                <h2 id="next-title" class="mt-1.5 font-serif text-[26px] font-light leading-tight text-ink">{{ n.label }}</h2>
                <p class="mt-2 max-w-xl text-sm text-ink-muted">{{ purpose(n.step) }}</p>
              </div>
              <a [routerLink]="nextLink()?.path" [queryParams]="nextLink()?.query ?? null" class="btn btn-primary self-start sm:self-auto">
                Continue <app-icon name="arrowRight" class="h-4 w-4" />
              </a>
            </div>
          </section>
        }

        <!-- Assessment cycles -->
        <section aria-labelledby="cycles-title">
          <div class="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="cycles-title" class="section-title">Assessment cycles</h2>
              <p class="section-subtitle">Run one after another in plan order. Each ends with an approved, cumulative attainment.</p>
            </div>
            <a routerLink="workbook" class="link-accent hidden text-[13px] sm:inline-flex">Open workbook <app-icon name="arrowRight" class="h-3.5 w-3.5" /></a>
          </div>

          @if (o.progress.cycles.length === 0) {
            <div class="card empty-state">
              <p class="empty-title">No assessments yet</p>
              <p class="empty-text">Cycles appear once the assessment plan is finalized.</p>
            </div>
          } @else {
            <div class="card overflow-hidden">
              <div class="table-wrap">
                <table class="data-table min-w-[640px]">
                  <thead>
                    <tr>
                      <th class="th w-14" scope="col"><span class="sr-only">Order</span></th>
                      <th class="th" scope="col">Assessment</th>
                      <th class="th text-center" scope="col">Paper</th>
                      <th class="th text-center" scope="col">Marksheet</th>
                      <th class="th text-center" scope="col">Marks</th>
                      <th class="th text-center" scope="col">Attainment</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of o.progress.cycles; track c.assessmentId) {
                      <tr>
                        <td class="td"><span class="numeral text-[22px]">{{ pad(c.order) }}</span></td>
                        <td class="td">
                          <span class="block font-semibold text-ink">{{ c.name }}</span>
                          <span class="block text-xs text-ink-muted">{{ category(c.category) }}</span>
                        </td>
                        <td class="td text-center">
                          @if (c.steps.paperValidation; as s) { <ng-container *ngTemplateOutlet="dot; context: { $implicit: s }" /> }
                          @else { <span class="text-xs text-ink-faint" title="No question paper for this assessment">n/a</span> }
                        </td>
                        <td class="td text-center"><ng-container *ngTemplateOutlet="dot; context: { $implicit: c.steps.marksheet }" /></td>
                        <td class="td text-center"><ng-container *ngTemplateOutlet="dot; context: { $implicit: c.steps.marksEntry }" /></td>
                        <td class="td text-center"><ng-container *ngTemplateOutlet="dot; context: { $implicit: c.steps.attainmentApproval }" /></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-5 py-3 text-xs text-ink-muted">
                <span class="inline-flex items-center gap-1.5"><app-icon name="check" class="h-3.5 w-3.5 text-ink" [stroke]="2.5" /> Done</span>
                <span class="inline-flex items-center gap-1.5"><span class="dot bg-brand"></span> Open now</span>
                <span class="inline-flex items-center gap-1.5"><app-icon name="lock" class="h-3.5 w-3.5 text-ink-faint" /> Locked</span>
              </div>
            </div>
          }
        </section>
      </div>
    }

    <ng-template #dot let-s>
      <span class="inline-flex" [attr.title]="title(s)">
        @switch (s.status) {
          @case ('DONE') { <app-icon name="check" class="h-4 w-4 text-ink" [stroke]="2.5" label="Done" /> }
          @case ('LOCKED') { <app-icon name="lock" class="h-4 w-4 text-ink-faint" label="Locked" /> }
          @default { <span class="dot h-2.5 w-2.5 bg-brand" role="img" aria-label="Open now"></span> }
        }
      </span>
    </ng-template>
  `,
})
export class CourseOverviewComponent {
  readonly ctx = inject(CourseContext);
  readonly nextLink = computed(() => {
    const o = this.ctx.offering();
    return o ? nextActionLink(o) : null;
  });

  purpose(step: keyof typeof STEP_PURPOSE): string { return STEP_PURPOSE[step]; }
  category = categoryLabel;
  pad(n: number): string { return n < 10 ? `0${n}` : String(n); }
  title(s: StepState): string {
    return s.status === 'LOCKED' ? (s.lockedReason ?? 'Locked') : s.status === 'DONE' ? 'Done' : 'Open now';
  }
  label = STEP_LABELS;
}
