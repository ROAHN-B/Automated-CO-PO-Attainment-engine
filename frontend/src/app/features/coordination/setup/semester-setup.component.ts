import { Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { IconComponent } from '../../../shared/ui/icon.component';
import { roman, termOf, yearOfStudy } from '../setup-steps';
import { SetupContext } from './setup-context';
import { SetupStepperComponent } from './setup-stepper.component';

/**
 * Semester setup workspace: the setup's header, the seven-step stepper and the
 * routed screen for the selected step.
 *   /faculty/coordination/semesters                       → all semesters (dashboard)
 *   /faculty/coordination/semesters/:setupId              → the current step
 *   /faculty/coordination/semesters/:setupId/step/:step   → one step
 */
@Component({
  selector: 'app-semester-setup',
  standalone: true,
  imports: [RouterOutlet, RouterLink, IconComponent, SetupStepperComponent],
  providers: [SetupContext],
  template: `
    <div class="page-wide">
      <a routerLink="/faculty/coordination/semesters" class="inline-flex items-center gap-1 text-[13px] font-medium text-ink-muted transition-colors duration-micro hover:text-ink">
        <app-icon name="chevronLeft" class="h-3.5 w-3.5" /> All semesters
      </a>

      @if (ctx.loading() && !ctx.setup()) {
        <div class="mt-4 space-y-4" aria-busy="true" aria-label="Loading the semester setup">
          <div class="skeleton h-24"></div>
          <div class="skeleton h-96"></div>
        </div>
      } @else if (ctx.error() && !ctx.setup()) { @let e = ctx.error()!;
        <div class="alert alert-error mt-6" role="alert">
          <app-icon name="alert" class="mt-0.5 h-4 w-4" />
          <div class="flex-1">
            <p class="font-semibold">{{ e.status === 404 ? 'Semester setup not found' : e.status === 403 ? 'This semester belongs to another department' : 'Couldn’t load this semester' }}</p>
            <p class="mt-0.5">{{ e.message }}</p>
          </div>
          @if (e.status >= 500 || e.status === 0) {
            <button type="button" class="btn btn-outline btn-sm" (click)="ctx.refresh(true)">Try again</button>
          }
        </div>
      } @else if (ctx.setup()) { @let s = ctx.setup()!;
        <header class="mt-3 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between animate-enter">
          <div>
            <p class="page-kicker">{{ s.department.departmentName }} · {{ s.academicYear.name }}</p>
            <h1 class="page-title">Semester {{ roman(s.semesterNumber) }}</h1>
            <dl class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-muted">
              <div class="flex gap-1.5"><dt>Class</dt><dd class="font-medium text-ink-soft">{{ yearOfStudy(s.semesterNumber) }} · {{ termOf(s.semesterNumber) }}</dd></div>
              <div class="flex gap-1.5"><dt>Divisions</dt><dd class="font-medium text-ink-soft">{{ s.divisions.length ? s.divisions.join(', ') : 'One class' }}</dd></div>
              <div class="flex gap-1.5"><dt>Syllabus</dt><dd class="font-medium text-ink-soft">Version {{ s.syllabusVersion }}</dd></div>
            </dl>
          </div>
          @if (s.status === 'COMPLETED') {
            <span class="chip chip-neutral self-start sm:self-auto"><app-icon name="check" class="h-3 w-3" [stroke]="2.5" /> Allocation completed</span>
          } @else {
            <span class="chip chip-brand self-start sm:self-auto">In progress</span>
          }
        </header>

        @if (wide()) {
          <!-- Wide steps (the load distribution table) get the full width; the steps become a strip. -->
          <div class="mt-6 border-b border-line pb-4" aria-label="Setup steps">
            <app-setup-stepper [steps]="ctx.steps()" layout="horizontal" />
          </div>
          <section class="mt-8 min-w-0">
            <router-outlet />
          </section>
        } @else {
          <div class="mt-8 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside class="lg:sticky lg:top-8 lg:self-start" aria-label="Setup steps">
              <p class="mb-3 px-2 text-xs font-semibold text-ink-muted">Semester setup</p>
              <app-setup-stepper [steps]="ctx.steps()" />
            </aside>
            <section class="min-w-0">
              <router-outlet />
            </section>
          </div>
        }
      }
    </div>
  `,
})
export class SemesterSetupComponent {
  readonly ctx = inject(SetupContext);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  /** Steps whose screen needs the full page width. */
  readonly wide = computed(() => /\/step\/syllabus(\?|$)/.test(this.url()));
  roman = roman;
  yearOfStudy = yearOfStudy;
  termOf = termOf;

  constructor() {
    inject(ActivatedRoute).paramMap
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(p => this.ctx.load(p.get('setupId') ?? ''));
  }
}
