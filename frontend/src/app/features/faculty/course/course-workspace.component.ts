import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon.component';
import { phaseLabel } from '../lifecycle';
import { CourseContext } from './course-context';
import { CourseStepperComponent } from './course-stepper.component';

/**
 * Course workspace shell: course header, section tabs, the lifecycle stepper
 * and the routed screen for the selected step.
 *   /faculty/courses/:offeringId            → overview
 *   /faculty/courses/:offeringId/workbook   → live course workbook
 *   /faculty/courses/:offeringId/attainment → attainment calculation
 *   /faculty/courses/:offeringId/step/:key  → individual lifecycle steps
 */
@Component({
  selector: 'app-course-workspace',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, CourseStepperComponent],
  providers: [CourseContext],
  template: `
    <div class="page-wide">
      <a routerLink="/faculty/dashboard" class="inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted transition-colors duration-micro hover:text-ink">
        <app-icon name="chevronLeft" class="h-3.5 w-3.5" /> All courses
      </a>

      @if (ctx.loading() && !ctx.offering()) {
        <div class="mt-4 space-y-4" aria-busy="true" aria-label="Loading course">
          <div class="skeleton h-24"></div>
          <div class="skeleton h-96"></div>
        </div>
      } @else if (ctx.error()) { @let e = ctx.error()!;
        <div class="alert alert-error mt-6" role="alert">
          <app-icon name="alert" class="mt-0.5 h-4 w-4" />
          <div class="flex-1">
            <p class="font-semibold">{{ e.status === 404 ? 'Course not found' : e.status === 403 ? 'You don’t have access to this course' : 'Couldn’t load this course' }}</p>
            <p class="mt-0.5">{{ e.message }}</p>
          </div>
          @if (e.status >= 500 || e.status === 0) {
            <button type="button" class="btn btn-outline btn-sm" (click)="ctx.refresh(true)">Try again</button>
          }
        </div>
      } @else if (ctx.offering()) { @let o = ctx.offering()!;
        <!-- Course header (mirrors the workbook's Main sheet header) -->
        <header class="mt-3 flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between animate-enter">
          <div>
            <p class="page-kicker">
              <span class="font-mono">{{ o.course.courseCode }}</span> · {{ o.assessmentScheme === 'THEORY' ? 'Theory' : 'Practical' }}
              · Semester {{ o.semester.semesterNumber }} · {{ o.academicYear.name }}
            </p>
            <h1 class="page-title">{{ o.course.courseName }}</h1>
            <dl class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-muted">
              <div class="flex gap-1.5"><dt>Class</dt><dd class="font-medium text-ink-soft">{{ o.className }}@if (o.division) { · Div {{ o.division }}}</dd></div>
              <div class="flex gap-1.5"><dt>Strength</dt><dd class="font-medium text-ink-soft tnum">{{ o.classStrength }}</dd></div>
              @if (o.courseCoordinator) {
                <div class="flex gap-1.5"><dt>Coordinator</dt><dd class="font-medium text-ink-soft">{{ o.courseCoordinator.fullName }}</dd></div>
              }
              <div class="flex gap-1.5"><dt>Phase</dt><dd class="font-medium text-brand">{{ phase(o.progress.phase) }}</dd></div>
            </dl>
          </div>

          <nav class="tabs self-start lg:self-auto" aria-label="Course sections">
            <a routerLink="." routerLinkActive="tab-active" [routerLinkActiveOptions]="{ exact: true }" class="tab inline-flex items-center">Overview</a>
            <a routerLink="workbook" routerLinkActive="tab-active" class="tab inline-flex items-center">Workbook</a>
            <a routerLink="attainment" routerLinkActive="tab-active" class="tab inline-flex items-center">Attainment</a>
          </nav>
        </header>

        <div class="mt-8 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside class="lg:sticky lg:top-8 lg:self-start" aria-label="Lifecycle">
            <p class="mb-3 px-2 text-xs font-semibold text-ink-muted">Course lifecycle</p>
            <app-course-stepper [progress]="o.progress" />
          </aside>
          <section class="min-w-0">
            <router-outlet />
          </section>
        </div>
      }
    </div>
  `,
})
export class CourseWorkspaceComponent {
  readonly ctx = inject(CourseContext);

  constructor() {
    inject(ActivatedRoute).paramMap
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(p => this.ctx.load(p.get('offeringId') ?? ''));
  }

  phase = phaseLabel;
}
