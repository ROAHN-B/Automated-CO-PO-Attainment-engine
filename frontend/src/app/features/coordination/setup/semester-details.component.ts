import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SETUP_STEP_PURPOSE, roman, termOf, yearOfStudy } from '../setup-steps';
import { SetupContext } from './setup-context';

/**
 * Step 1, Semester (API_CONTRACT §15.1): what this setup covers, and its
 * divisions, which can change until the allocation is completed (CRD-15).
 */
@Component({
  selector: 'app-semester-details',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, IconComponent],
  template: `
    @if (ctx.setup(); as s) {
      <div class="space-y-6 animate-enter">
        <header>
          <p class="page-kicker">Step 1 of {{ ctx.steps().length }}</p>
          <h2 class="mt-1.5 font-serif text-[32px] font-light leading-tight text-ink">Semester</h2>
          <p class="mt-2 max-w-2xl text-[15px] text-ink-soft">{{ purpose }}</p>
        </header>

        <section class="card">
          <dl class="grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2">
            <div><dt class="stat-label">Department</dt><dd class="mt-1 text-sm text-ink">{{ s.department.departmentName }}</dd></div>
            <div><dt class="stat-label">Academic year</dt><dd class="mt-1 text-sm text-ink">{{ s.academicYear.name }}</dd></div>
            <div><dt class="stat-label">Semester</dt><dd class="mt-1 text-sm text-ink">Semester {{ roman(s.semesterNumber) }} · {{ yearOfStudy(s.semesterNumber) }}, {{ termOf(s.semesterNumber).toLowerCase() }}</dd></div>
            <div><dt class="stat-label">Created</dt><dd class="mt-1 text-sm text-ink">{{ s.createdAt | date: 'd MMM y' }} by {{ s.createdBy }}</dd></div>
          </dl>
        </section>

        <section class="card" aria-labelledby="sd-div-title">
          <form class="space-y-4 p-6" (ngSubmit)="save()">
            <div>
              <h3 id="sd-div-title" class="text-[15px] font-semibold text-ink">Divisions</h3>
              <p class="mt-1 text-sm text-ink-muted">Each division gets its own faculty member for every subject.</p>
            </div>

            @if (s.status === 'COMPLETED') {
              <p class="text-sm text-ink">{{ s.divisions.length ? s.divisions.join(', ') : 'One class, no divisions' }}</p>
              <p class="text-xs text-ink-muted">The allocation is completed, so the divisions can no longer change.</p>
            } @else {
              <fieldset class="space-y-2 text-sm text-ink">
                <legend class="sr-only">Divisions</legend>
                <label class="flex items-center gap-2.5">
                  <input type="radio" name="hasDivisions" [(ngModel)]="hasDivisions" [value]="false" /> One class, no divisions
                </label>
                <label class="flex items-center gap-2.5">
                  <input type="radio" name="hasDivisions" [(ngModel)]="hasDivisions" [value]="true" /> Several divisions
                </label>
              </fieldset>
              @if (hasDivisions) {
                <div class="field max-w-sm">
                  <label class="sr-only" for="sd-divs">Division names</label>
                  <input id="sd-divs" name="divisions" class="field-input" [(ngModel)]="divisionsText" placeholder="A, B" />
                  <p class="field-help">Separate names with commas. Removing a division drops the draft allocations made for it.</p>
                </div>
              }

              @if (saveError(); as e) {
                <div class="alert alert-error" role="alert">
                  <app-icon name="alert" class="mt-0.5 h-4 w-4" />
                  <div class="flex-1"><p>{{ e.message }}</p></div>
                  @if (e.errorCode === 'VERSION_CONFLICT') {
                    <button type="button" class="btn btn-outline btn-sm" (click)="reload()">Reload</button>
                  }
                </div>
              }
              @if (saved()) {
                <p class="text-sm text-ink-soft" role="status">Divisions saved.</p>
              }

              <div class="flex justify-end">
                <button type="submit" class="btn btn-primary" [disabled]="saving() || !changed()">
                  @if (saving()) { <span class="spinner"></span> Saving… } @else { Save divisions }
                </button>
              </div>
            }
          </form>
        </section>

        <div class="flex justify-end">
          <a class="btn btn-outline" routerLink="../faculty">Next: Faculty <app-icon name="arrowRight" class="h-4 w-4" /></a>
        </div>
      </div>
    }
  `,
})
export class SemesterDetailsComponent {
  readonly ctx = inject(SetupContext);
  private readonly api = inject(CoordinationService);

  readonly purpose = SETUP_STEP_PURPOSE.SEMESTER;
  roman = roman;
  yearOfStudy = yearOfStudy;
  termOf = termOf;

  hasDivisions = false;
  divisionsText = '';
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly saveError = signal<WorkspaceError | null>(null);
  /** Whether the form differs from what the server holds. */
  changed(): boolean {
    const s = this.ctx.setup();
    return !!s && this.formDivisions().join(',') !== s.divisions.join(',');
  }

  constructor() {
    // Reset the form whenever the server's copy changes.
    effect(() => {
      const s = this.ctx.setup();
      if (!s) return;
      this.hasDivisions = s.divisions.length > 0;
      this.divisionsText = s.divisions.join(', ');
    });
  }

  save(): void {
    const s = this.ctx.setup();
    if (!s) return;
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set(null);
    this.api.updateSetup(s.setupId, { version: s.version, divisions: this.formDivisions() }).subscribe({
      next: updated => { this.saving.set(false); this.saved.set(true); this.ctx.setup.set(updated); },
      error: (e: WorkspaceError) => { this.saving.set(false); this.saveError.set(e); },
    });
  }

  reload(): void {
    this.saveError.set(null);
    this.ctx.refresh();
  }

  /** What the form would send; the server still validates and normalises it. */
  private formDivisions(): string[] {
    return this.hasDivisions ? this.divisionsText.split(',').map(d => d.trim().toUpperCase()).filter(Boolean) : [];
  }
}
