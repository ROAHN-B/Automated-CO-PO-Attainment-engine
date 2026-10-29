import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DECLARATION_STATEMENT, LoadDistribution } from '../../../core/models/coordination.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SETUP_STEP_PURPOSE, roman } from '../setup-steps';
import { SetupContext } from '../setup/setup-context';

/**
 * Step 5, Declaration (API_CONTRACT §15.4.3): the coordinator confirms the load
 * distribution (CRD-21), which locks it; a revision (CRD-22) starts a new draft
 * version that needs a new declaration.
 */
@Component({
  selector: 'app-syllabus-declaration',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, IconComponent, BodyPortalDirective],
  template: `
    <div class="space-y-6 animate-enter">
      <header>
        <p class="page-kicker">Step 5 of {{ ctx.steps().length || 7 }}</p>
        <h2 class="mt-1.5 font-serif text-[32px] font-light leading-tight text-ink">Declaration</h2>
        <p class="mt-2 max-w-2xl text-[15px] text-ink-soft">{{ purpose }}</p>
      </header>

      @if (loading() && !load()) {
        <div class="skeleton h-72" aria-busy="true" aria-label="Loading the declaration"></div>
      } @else if (error()) { @let e = error()!;
        <div class="alert alert-error" role="alert">
          <app-icon name="alert" class="mt-0.5 h-4 w-4" />
          <div class="flex-1"><p class="font-semibold">Couldn’t load the syllabus</p><p class="mt-0.5">{{ e.message }}</p></div>
          <button type="button" class="btn btn-outline btn-sm" (click)="reload()">Try again</button>
        </div>
      } @else if (load()) { @let l = load()!;
        <!-- What is being declared -->
        <section class="card" aria-labelledby="dc-summary">
          <div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-6 py-4">
            <h3 id="dc-summary" class="text-[15px] font-semibold text-ink">
              Semester {{ roman(ctx.setup()?.semesterNumber ?? 0) }} · {{ ctx.setup()?.academicYear?.name }} · syllabus version {{ l.syllabusVersion }}
            </h3>
            <a routerLink="../syllabus" class="link-accent text-sm">View the table</a>
          </div>
          <dl class="grid grid-cols-2 gap-x-6 gap-y-4 px-6 py-5 sm:grid-cols-4">
            <div><dt class="stat-label">Courses</dt><dd class="mt-1 font-serif text-2xl font-light text-ink tnum">{{ l.rows.length }}</dd></div>
            <div><dt class="stat-label">Credits</dt><dd class="mt-1 font-serif text-2xl font-light text-ink tnum">{{ l.totals.grand.credits }}</dd></div>
            <div><dt class="stat-label">Hours per week</dt><dd class="mt-1 font-serif text-2xl font-light text-ink tnum">{{ l.totals.grand.lecture + l.totals.grand.tutorial + l.totals.grand.practical }}</dd></div>
            <div><dt class="stat-label">Total marks</dt><dd class="mt-1 font-serif text-2xl font-light text-ink tnum">{{ l.totals.grand.total }}</dd></div>
          </dl>
        </section>

        @if (l.status === 'DECLARED' && l.declaration; as d) {
          <!-- Declared -->
          <section class="card p-6" aria-labelledby="dc-done">
            <p class="flex items-center gap-2 text-xs font-semibold text-brand"><app-icon name="lock" class="h-3.5 w-3.5" /> Declared</p>
            <h3 id="dc-done" class="mt-2 font-serif text-2xl font-light text-ink">Declared by {{ d.declaredBy.fullName }}</h3>
            <p class="mt-1 text-sm text-ink-muted">{{ d.declaredAt | date: 'd MMM y, h:mm a' }} · {{ d.department.departmentName }} · {{ d.academicYear.name }} · Semester {{ roman(d.semesterNumber) }} · version {{ d.syllabusVersion }}</p>
            <blockquote class="mt-4 border-l-2 border-brand-200 pl-4 text-sm leading-relaxed text-ink-soft">{{ d.statement }}</blockquote>

            <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              @if (ctx.setup()?.status === 'COMPLETED') {
                <p class="text-sm text-ink-muted">The allocation is completed, so this syllabus can no longer be revised.</p>
              } @else {
                <p class="text-sm text-ink-muted">Found a mistake? A revision starts a new draft version that must be declared again.</p>
                <button type="button" class="btn btn-outline" (click)="revising.set(true)">Revise the syllabus</button>
              }
            </div>
          </section>
          <div class="flex justify-end">
            <a class="btn btn-primary" routerLink="../allocation">Next: Subject allocation <app-icon name="arrowRight" class="h-4 w-4" /></a>
          </div>
        } @else {
          @if (stepState()?.status === 'LOCKED') {
            <div class="alert alert-info">
              <app-icon name="lock" class="mt-0.5 h-4 w-4" />
              <div>
                <p class="font-semibold text-ink">Not ready to declare</p>
                <p class="mt-0.5">{{ stepState()?.lockedReason }}</p>
              </div>
            </div>
          }

          <!-- Confirm -->
          <section class="card p-6" aria-labelledby="dc-confirm" [class.opacity-60]="stepState()?.status === 'LOCKED'">
            <h3 id="dc-confirm" class="font-serif text-2xl font-light text-ink">Declaration</h3>
            <p class="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink">{{ statement }}</p>
            <label class="mt-5 flex items-start gap-2.5 text-sm font-medium text-ink">
              <input type="checkbox" class="mt-0.5" [(ngModel)]="confirmed" [disabled]="stepState()?.status === 'LOCKED' || busy()" />
              I confirm that the above information is correct.
            </label>
            <p class="mt-2 text-xs text-ink-muted">Your name, the date and time, and this syllabus version are recorded. The table then locks.</p>

            @if (actionError()) {
              <div class="alert alert-error mt-4" role="alert">
                <app-icon name="alert" class="mt-0.5 h-4 w-4" />
                <p class="flex-1">{{ actionError() }}</p>
              </div>
            }

            <div class="mt-6 flex justify-end">
              <button type="button" class="btn btn-primary" (click)="declare()" [disabled]="!confirmed || busy() || stepState()?.status === 'LOCKED'">
                @if (busy()) { <span class="spinner"></span> Declaring… } @else { Confirm and continue }
              </button>
            </div>
          </section>
        }
      }
    </div>

    @if (revising()) {
      <div class="modal-backdrop" appBodyPortal (click)="busy() || revising.set(false)">
        <div class="modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="dc-rev-title" (click)="$event.stopPropagation()">
          <div class="space-y-4 p-6">
            <h3 id="dc-rev-title" class="font-serif text-2xl font-light text-ink">Revise the syllabus?</h3>
            <p class="text-sm leading-relaxed text-ink-soft">
              Version {{ load()?.syllabusVersion }} and its declaration stay on record. You edit a copy as version {{ (load()?.syllabusVersion ?? 0) + 1 }},
              and the semester goes back to the syllabus step until you declare again. Draft allocations of courses you keep are kept.
            </p>
            <div class="field">
              <label class="field-label" for="dc-reason">Why is it being revised?</label>
              <textarea id="dc-reason" class="field-textarea" [(ngModel)]="reason" placeholder="e.g. The ICA marks of the IoT Lab were entered as 50; the syllabus says 25."></textarea>
            </div>
            @if (actionError()) { <p class="field-error">{{ actionError() }}</p> }
          </div>
          <div class="flex justify-end gap-2 border-t border-line px-6 py-4">
            <button type="button" class="btn btn-ghost" [disabled]="busy()" (click)="revising.set(false)">Cancel</button>
            <button type="button" class="btn btn-primary" [disabled]="busy() || !reason.trim()" (click)="revise()">
              @if (busy()) { <span class="spinner"></span> Starting… } @else { Start version {{ (load()?.syllabusVersion ?? 0) + 1 }} }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DeclarationComponent {
  private readonly api = inject(CoordinationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly ctx = inject(SetupContext);

  readonly purpose = SETUP_STEP_PURPOSE.DECLARATION;
  readonly statement = DECLARATION_STATEMENT;
  roman = roman;

  readonly load = signal<LoadDistribution | null>(null);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly revising = signal(false);
  confirmed = false;
  reason = '';

  readonly stepState = computed(() => this.ctx.steps().find(s => s.id === 'DECLARATION')?.state ?? null);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.loadDistribution(this.ctx.setupId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: l => { this.load.set(l); this.loading.set(false); },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  declare(): void {
    const l = this.load();
    if (!l) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.api.declareSyllabus(this.ctx.setupId(), l.version).subscribe({
      next: saved => {
        this.busy.set(false);
        this.load.set(saved);
        this.confirmed = false;
        this.ctx.refresh();
      },
      error: (e: WorkspaceError) => { this.busy.set(false); this.actionError.set(e.message); },
    });
  }

  revise(): void {
    const l = this.load();
    if (!l) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.api.reviseSyllabus(this.ctx.setupId(), l.version, this.reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.revising.set(false);
        this.reason = '';
        this.ctx.refresh();
        this.router.navigate(['../syllabus'], { relativeTo: this.route });
      },
      error: (e: WorkspaceError) => { this.busy.set(false); this.actionError.set(e.message); },
    });
  }
}
