
import {
  Component,
  DestroyRef,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  FacultyService,
  RealCourseOffering
} from '../../../core/api/faculty.service';

import {
  CourseOutcome,
  CourseOutcomeService
} from '../../../core/api/course-outcome.service';

type CourseTab = 'overview' | 'workbook' | 'attainment';

@Component({
  selector: 'app-real-course-overview',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="page-wide">
      <a
        routerLink="/faculty/dashboard"
        class="text-sm text-ink-muted hover:text-ink"
      >
        ← All courses
      </a>

      @if (loading()) {
        <div class="mt-8 skeleton h-32"></div>
      } @else if (error()) {
        <div class="alert alert-error mt-6" role="alert">
          {{ error() }}
        </div>
      } @else if (course()) {
        @let c = course()!;

        <header
          class="mt-4 flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div>
            <p class="page-kicker">
              {{ c.courseCode }} · {{ c.courseType }}
              · {{ c.academicYear }}
            </p>

            <h1 class="page-title">{{ c.courseName }}</h1>

            <div
              class="mt-3 flex flex-wrap gap-5 text-sm text-ink-muted"
            >
              <span>Credits: {{ c.credits }}</span>
              <span>Status: {{ c.status }}</span>
              <span>Phase: Setup</span>
            </div>
          </div>

          <nav
            class="tabs self-start lg:self-auto"
            aria-label="Course sections"
          >
            <button
              type="button"
              class="tab"
              [class.tab-active]="activeTab() === 'overview'"
              (click)="activeTab.set('overview')"
            >
              Overview
            </button>

            <button
              type="button"
              class="tab"
              [class.tab-active]="activeTab() === 'workbook'"
              (click)="activeTab.set('workbook')"
            >
              Workbook
            </button>

            <button
              type="button"
              class="tab"
              [class.tab-active]="activeTab() === 'attainment'"
              (click)="activeTab.set('attainment')"
            >
              Attainment
            </button>
          </nav>
        </header>

        <div
          class="mt-8 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]"
        >
          <aside class="lg:sticky lg:top-8 lg:self-start">
            <p class="mb-4 px-2 text-xs font-semibold text-ink-muted">
              Course lifecycle
            </p>

            <div class="space-y-2">
              @for (step of lifecycleSteps; track step.name; let i = $index) {
                <div
                  class="flex items-center gap-3 rounded-lg px-3 py-3"
                  [class.bg-paper-deep]="i === 0"
                >
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-xs"
                  >
                    {{ i === 0 ? '●' : '○' }}
                  </span>

                  <div>
                    <p class="text-sm font-medium">{{ step.name }}</p>
                    <p class="text-xs text-ink-muted">
                      {{ i === 0 ? 'Setup in progress' : 'Not configured' }}
                    </p>
                  </div>
                </div>
              }
            </div>
          </aside>

          <main class="min-w-0">

            @if (activeTab() === 'overview') {
              <section class="card p-6">
                <p class="page-kicker">Your next step</p>
                <h2 class="mt-2 text-xl font-medium">
                  Define and manage Course Outcomes
                </h2>
                <p class="mt-2 text-sm text-ink-muted">
                  Configure the course outcomes before proceeding
                  with assessments and attainment.
                </p>

                <button
                  type="button"
                  class="btn btn-primary mt-5"
                  (click)="startCreate()"
                >
                  + Add Course Outcome
                </button>
              </section>

              <section class="card mt-6 p-6">
                <h2 class="section-title">Course Information</h2>

                <dl class="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <dt class="text-sm text-ink-muted">Course Code</dt>
                    <dd class="font-medium">{{ c.courseCode }}</dd>
                  </div>

                  <div>
                    <dt class="text-sm text-ink-muted">Course Type</dt>
                    <dd class="font-medium">{{ c.courseType }}</dd>
                  </div>

                  <div>
                    <dt class="text-sm text-ink-muted">Credits</dt>
                    <dd class="font-medium">{{ c.credits }}</dd>
                  </div>

                  <div>
                    <dt class="text-sm text-ink-muted">Status</dt>
                    <dd class="font-medium">{{ c.status }}</dd>
                  </div>

                  <div>
                    <dt class="text-sm text-ink-muted">Academic Year</dt>
                    <dd class="font-medium">{{ c.academicYear }}</dd>
                  </div>

                  <div>
                    <dt class="text-sm text-ink-muted">Offering ID</dt>
                    <dd class="break-all font-mono text-xs">
                      {{ c.offeringId }}
                    </dd>
                  </div>
                </dl>
              </section>

              <section class="card mt-6 p-6" id="course-outcomes">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <h2 class="section-title">Course Outcomes</h2>
                    <p class="mt-1 text-sm text-ink-muted">
                      Real data from MongoDB Atlas
                    </p>
                  </div>

                  <button
                    type="button"
                    class="btn btn-primary"
                    (click)="startCreate()"
                  >
                    + Add CO
                  </button>
                </div>

                @if (coMessage()) {
                  <p class="mt-4 text-sm" role="status">
                    {{ coMessage() }}
                  </p>
                }

                @if (coError()) {
                  <div class="alert alert-error mt-4" role="alert">
                    {{ coError() }}
                  </div>
                }

                @if (coLoading()) {
                  <div class="mt-5 skeleton h-20"></div>
                } @else if (outcomes().length === 0) {
                  <p class="mt-5 text-sm text-ink-muted">
                    No Course Outcomes have been defined yet.
                  </p>
                } @else {
                  <div class="mt-5 grid gap-4">
                    @for (co of outcomes(); track co.id) {
                      <div
                        class="rounded-xl border border-line p-4"
                      >
                        <div
                          class="flex items-start justify-between gap-4"
                        >
                          <div>
                            <h3 class="font-semibold">
                              {{ co.coCode }}
                            </h3>

                            <p class="mt-2 text-sm">
                              {{ co.description }}
                            </p>

                            <p class="mt-2 text-xs text-ink-muted">
                              Bloom's Taxonomy Level:
                              {{ co.bloomLevel }}
                            </p>
                          </div>

                          <div class="flex gap-2">
                            <button
                              type="button"
                              class="btn btn-secondary"
                              [disabled]="saving()"
                              (click)="startEdit(co)"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              class="btn btn-secondary"
                              [disabled]="saving()"
                              (click)="deleteCo(co)"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }

                @if (showForm()) {
                  <form
                  id="co-form"
                    class="mt-6 rounded-xl border border-line p-5"
                    (ngSubmit)="saveCo()"
                  >
                    <h3 class="font-semibold">
                      {{ editingId()
                        ? 'Edit Course Outcome'
                        : 'Add Course Outcome' }}
                    </h3>

                    <div class="mt-4 grid gap-4">
                      <label class="grid gap-2">
                        <span class="text-sm font-medium">CO Code</span>
                        <input
                          class="input"
                          name="coCode"
                          [(ngModel)]="formCode"
                          [disabled]="!!editingId()"
                          placeholder="CO1"
                          required
                        />
                      </label>

                      <label class="grid gap-2">
                        <span class="text-sm font-medium">
                          Description
                        </span>
                        <textarea
                          class="input"
                          name="description"
                          [(ngModel)]="formDescription"
                          rows="3"
                          required
                        ></textarea>
                      </label>

                      <label class="grid gap-2">
                        <span class="text-sm font-medium">
                          Bloom Level (1–6)
                        </span>
                        <select
                          class="input"
                          name="bloomLevel"
                          [(ngModel)]="formBloomLevel"
                        >
                          @for (level of bloomLevels; track level) {
                            <option [ngValue]="level">
                              {{ level }}
                            </option>
                          }
                        </select>
                      </label>
                    </div>

                    <div class="mt-5 flex gap-3">
                      <button
                        type="submit"
                        class="btn btn-primary"
                        [disabled]="saving()"
                      >
                        {{ saving() ? 'Saving...' : 'Save CO' }}
                      </button>

                      <button
                        type="button"
                        class="btn btn-secondary"
                        [disabled]="saving()"
                        (click)="cancelForm()"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                }
              </section>

              <section class="card mt-6 p-6">
                <h2 class="section-title">Assessment Cycles</h2>
                <p class="mt-3 text-sm text-ink-muted">
                  No real assessment cycles have been configured yet.
                  Once the assessment backend is connected,
                  their progress will appear here.
                </p>
              </section>
            }

            @if (activeTab() === 'workbook') {
              <section class="card p-6">
                <p class="page-kicker">Course workbook</p>
                <h2 class="mt-2 text-2xl font-medium">
                  Workbook
                </h2>
                <p class="mt-4 text-sm text-ink-muted">
                  The real course workbook is not connected
                  to the backend yet. No workbook data
                  is being simulated on this page.
                </p>
              </section>
            }

            @if (activeTab() === 'attainment') {
              <section class="card p-6">
                <p class="page-kicker">Cumulative attainment</p>
                <h2 class="mt-2 text-2xl font-medium">
                  CO–PO Attainment
                </h2>

                <p class="mt-4 text-sm text-ink-muted">
                  Attainment calculation is pending
                  backend integration.
                </p>

                <div class="mt-6 rounded-xl border border-line p-5">
                  <h3 class="font-semibold">Current status</h3>
                  <p class="mt-2 text-sm text-ink-muted">
                    No verified assessment marks,
                    attainment calculations or approval
                    records are available for this real course.
                  </p>

                  <button
                    type="button"
                    class="btn btn-primary mt-5"
                    disabled
                  >
                    Calculate CO–PO Attainment
                  </button>
                </div>
              </section>
            }

          </main>
        </div>
      }
    </div>
  `
})
export class RealCourseOverviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly facultyService = inject(FacultyService);
  private readonly coService = inject(CourseOutcomeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly course = signal<RealCourseOffering | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly activeTab = signal<CourseTab>('overview');

  readonly outcomes = signal<CourseOutcome[]>([]);
  readonly coLoading = signal(false);
  readonly coError = signal<string | null>(null);
  readonly coMessage = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly bloomLevels = [1, 2, 3, 4, 5, 6];

  readonly lifecycleSteps = [
    { name: 'Setup' },
    { name: 'ISE-1' },
    { name: 'ISE-2' },
    { name: 'Activity 1' },
    { name: 'ISE-3' },
    { name: 'Activity 2' },
    { name: 'ESE' },
    { name: 'Close-out' }
  ];

  formCode = '';
  formDescription = '';
  formBloomLevel = 1;

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const offeringId = params.get('offeringId');

        this.course.set(null);
        this.outcomes.set([]);
        this.error.set(null);
        this.coError.set(null);
        this.coMessage.set(null);
        this.activeTab.set('overview');
        this.cancelForm();

        if (!offeringId) {
          this.loading.set(false);
          this.error.set('Course offering ID is missing.');
          return;
        }

        this.loading.set(true);

        this.facultyService.getRealCourseOffering(offeringId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: response => {
              if (!response.success || !response.data) {
                this.error.set('Course details are unavailable.');
              } else {
                this.course.set(response.data);
                this.loadOutcomes(response.data.courseId);
              }

              this.loading.set(false);
            },
            error: () => {
              this.error.set(
                'Unable to load course from the backend.'
              );
              this.loading.set(false);
            }
          });
      });
  }

  loadOutcomes(courseId: string): void {
    this.coLoading.set(true);
    this.coError.set(null);

    this.coService.getByCourseId(courseId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          if (response.success && Array.isArray(response.data)) {
            this.outcomes.set(response.data);
          } else {
            this.coError.set('Unable to read Course Outcomes.');
          }

          this.coLoading.set(false);
        },
        error: () => {
          this.coError.set(
            'Unable to load Course Outcomes from backend.'
          );
          this.coLoading.set(false);
        }
      });
  }
  startCreate(): void {
    this.activeTab.set('overview');
    this.editingId.set(null);
    this.formCode = '';
    this.formDescription = '';
    this.formBloomLevel = 1;
    this.coError.set(null);
    this.coMessage.set(null);
    this.showForm.set(true);

    setTimeout(() => {
      document
        .getElementById('co-form')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
    }, 100);
  }

  startEdit(co: CourseOutcome): void {
    this.editingId.set(co.id);
    this.formCode = co.coCode;
    this.formDescription = co.description;
    this.formBloomLevel = co.bloomLevel;
    this.coError.set(null);
    this.coMessage.set(null);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  saveCo(): void {
    const currentCourse = this.course();
    if (!currentCourse || this.saving()) return;

    const coCode = this.formCode.trim().toUpperCase();
    const description = this.formDescription.trim();

    if (
      !/^CO[1-9][0-9]*$/.test(coCode) ||
      !description ||
      this.formBloomLevel < 1 ||
      this.formBloomLevel > 6
    ) {
      this.coError.set(
        'Enter a valid CO code, description and Bloom level.'
      );
      return;
    }

    this.saving.set(true);
    this.coError.set(null);
    this.coMessage.set(null);

    const id = this.editingId();

    const request = id
      ? this.coService.update(id, {
        description,
        bloomLevel: this.formBloomLevel
      })
      : this.coService.create({
        courseId: currentCourse.courseId,
        coCode,
        description,
        bloomLevel: this.formBloomLevel
      });

    request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.saving.set(false);

          if (!response.success) {
            this.coError.set('Unable to save Course Outcome.');
            return;
          }

          this.cancelForm();

          this.coMessage.set(
            id
              ? 'Course Outcome updated.'
              : 'Course Outcome created.'
          );

          this.loadOutcomes(currentCourse.courseId);
        },
        error: err => {
          this.saving.set(false);
          this.coError.set(
            err?.error?.message ||
            'Unable to save Course Outcome.'
          );
        }
      });
  }

  deleteCo(co: CourseOutcome): void {
    const currentCourse = this.course();
    if (!currentCourse || this.saving()) return;

    if (!confirm('Delete ' + co.coCode + '?')) return;

    this.saving.set(true);
    this.coError.set(null);
    this.coMessage.set(null);

    this.coService.delete(co.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.saving.set(false);

          if (response.success) {
            this.coMessage.set(co.coCode + ' deleted.');
            this.loadOutcomes(currentCourse.courseId);
          } else {
            this.coError.set('Unable to delete Course Outcome.');
          }
        },
        error: err => {
          this.saving.set(false);
          this.coError.set(
            err?.error?.message ||
            'Unable to delete Course Outcome.'
          );
        }
      });
  }
}
