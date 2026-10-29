import { DatePipe, NgClass } from '@angular/common';
import { Component, DestroyRef, WritableSignal, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OutcomeSet } from '../../../core/models/coordination.model';
import { OutcomeKind } from '../../../core/models/faculty-workspace.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SETUP_STEP_PURPOSE } from '../setup-steps';
import { SetupContext } from '../setup/setup-context';

interface Draft { code: string; title: string; statement: string }

interface SetState {
  server: OutcomeSet | null;
  draft: Draft[];
  saving: boolean;
  errors: Record<string, string>;
  message: string | null;
  conflict: boolean;
  saved: boolean;
}

const blank = (): SetState => ({ server: null, draft: [], saving: false, errors: {}, message: null, conflict: false, saved: false });

/**
 * POs and PSOs (API_CONTRACT §15.5): the 11 POs shared by every department and
 * this department's 3 PSOs. Each set saves on its own as a new version
 * (CRD-26, CRD-28). Shown as step 4 of a semester setup and from the sidebar.
 */
@Component({
  selector: 'app-outcomes',
  standalone: true,
  imports: [DatePipe, NgClass, FormsModule, RouterLink, IconComponent],
  template: `
    <div [ngClass]="ctx ? 'space-y-8 animate-enter' : 'page space-y-8'">
      @if (ctx) {
        <header>
          <p class="page-kicker">Step 4 of {{ ctx.steps().length || 7 }}</p>
          <h2 class="mt-1.5 font-serif text-[32px] font-light leading-tight text-ink">POs and PSOs</h2>
          <p class="mt-2 max-w-2xl text-[15px] text-ink-soft">{{ purpose }}</p>
        </header>
      } @else {
        <header class="page-header">
          <div>
            <p class="page-kicker">Coordination</p>
            <h1 class="page-title">POs and PSOs</h1>
            <p class="page-subtitle">The outcomes every course’s CAM is mapped against. Faculty see them read-only.</p>
          </div>
        </header>
      }

      @if (loadError()) {
        <div class="alert alert-error" role="alert">
          <app-icon name="alert" class="mt-0.5 h-4 w-4" />
          <div class="flex-1"><p class="font-semibold">Couldn’t load the outcomes</p><p class="mt-0.5">{{ loadError() }}</p></div>
          <button type="button" class="btn btn-outline btn-sm" (click)="load()">Try again</button>
        </div>
      }

      @for (kind of kinds; track kind) { @let s = state[kind]();
        <section class="card" [attr.aria-labelledby]="'oc-' + kind">
          <div class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
            <div>
              <h3 [id]="'oc-' + kind" class="font-serif text-2xl font-light text-ink">
                {{ kind === 'PSO' ? 'Programme specific outcomes' : 'Programme outcomes' }}
              </h3>
              <p class="mt-1 text-sm text-ink-soft">
                @if (kind === 'PSO') { Exactly 3 PSOs for {{ departmentName() }}. Only this department uses them. }
                @else { Exactly 11 POs, shared by every department. A change here applies to all of them. }
              </p>
            </div>
            @if (s.server; as srv) {
              <p class="text-xs text-ink-muted">Version {{ srv.version }} · {{ srv.updatedAt | date: 'd MMM y' }} by {{ srv.updatedBy }}</p>
            }
          </div>

          @if (!s.server) {
            <div class="skeleton m-6 h-40" aria-busy="true"></div>
          } @else {
            <ol class="divide-y divide-line-soft">
              @for (o of s.draft; track o.code; let i = $index) {
                <li class="grid gap-3 px-6 py-4 sm:grid-cols-[64px_minmax(0,1fr)]">
                  <span class="numeral pt-2 text-xl">{{ o.code }}</span>
                  <div class="grid gap-2">
                    <label class="sr-only" [for]="'oc-' + o.code + '-t'">{{ o.code }} title</label>
                    <input [id]="'oc-' + o.code + '-t'" class="field-input h-10" [(ngModel)]="o.title" maxlength="120"
                           placeholder="Short title (optional), e.g. Engineering knowledge" [disabled]="s.saving" />
                    <label class="sr-only" [for]="'oc-' + o.code + '-s'">{{ o.code }} statement</label>
                    <textarea [id]="'oc-' + o.code + '-s'" class="field-textarea min-h-[72px]" [(ngModel)]="o.statement" maxlength="1000"
                              [class.field-invalid]="s.errors['items[' + i + '].statement']" [disabled]="s.saving"
                              [placeholder]="'What graduates can do (' + o.code + ')'"
                              [attr.aria-invalid]="!!s.errors['items[' + i + '].statement']"></textarea>
                    @if (s.errors['items[' + i + '].statement']) { <p class="field-error">{{ s.errors['items[' + i + '].statement'] }}</p> }
                  </div>
                </li>
              }
            </ol>

            <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
              <div class="text-sm" role="status">
                @if (s.message) {
                  <span class="text-gap">{{ s.message }}</span>
                  @if (s.conflict) { <button type="button" class="link-accent ml-2" (click)="load()">Reload</button> }
                } @else if (s.saved && !changed(kind)) {
                  <span class="text-ink-soft">Saved as version {{ s.server.version }}.</span>
                } @else if (missing(kind)) {
                  <span class="text-ink-muted">{{ missing(kind) }} {{ missing(kind) === 1 ? 'statement is' : 'statements are' }} still empty.</span>
                }
              </div>
              <div class="flex gap-2">
                <button type="button" class="btn btn-ghost" (click)="reset(kind)" [disabled]="s.saving || !changed(kind)">Undo changes</button>
                <button type="button" class="btn btn-primary" (click)="save(kind)" [disabled]="s.saving || !changed(kind)">
                  @if (s.saving) { <span class="spinner"></span> Saving… } @else { Save {{ kind }}s }
                </button>
              </div>
            </div>
          }
        </section>
      }

      @if (ctx) {
        <div class="flex justify-between gap-2">
          <a class="btn btn-ghost" routerLink="../syllabus"><app-icon name="chevronLeft" class="h-4 w-4" /> Syllabus</a>
          <a class="btn btn-outline" routerLink="../declaration">Next: Declaration <app-icon name="arrowRight" class="h-4 w-4" /></a>
        </div>
      }
    </div>
  `,
})
export class OutcomesComponent {
  private readonly api = inject(CoordinationService);
  private readonly destroyRef = inject(DestroyRef);
  /** Present when shown inside a semester setup. */
  readonly ctx = inject(SetupContext, { optional: true });

  readonly purpose = SETUP_STEP_PURPOSE.OUTCOMES;
  /** PSOs first: they're the department's own and usually the ones to fill. */
  readonly kinds: OutcomeKind[] = ['PSO', 'PO'];
  readonly state: Record<OutcomeKind, WritableSignal<SetState>> = { PO: signal(blank()), PSO: signal(blank()) };
  readonly loadError = signal<string | null>(null);
  readonly department = signal<string | null>(null);

  constructor() {
    if (!this.ctx) {
      this.api.overview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: o => this.department.set(o.department.departmentName) });
    }
    this.load();
  }

  departmentName(): string {
    return this.ctx?.setup()?.department.departmentName ?? this.department() ?? 'your department';
  }

  load(): void {
    this.loadError.set(null);
    for (const kind of this.kinds) {
      this.api.outcomes(kind).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: set => this.state[kind].set({ ...blank(), server: set, draft: this.toDraft(set) }),
        error: (e: WorkspaceError) => this.loadError.set(e.message),
      });
    }
  }

  changed(kind: OutcomeKind): boolean {
    const s = this.state[kind]();
    return !!s.server && JSON.stringify(s.draft) !== JSON.stringify(this.toDraft(s.server));
  }

  /** Empty statements in the form (a hint; the server decides what's complete). */
  missing(kind: OutcomeKind): number {
    return this.state[kind]().draft.filter(o => !o.statement.trim()).length;
  }

  reset(kind: OutcomeKind): void {
    this.state[kind].update(s => ({ ...s, draft: s.server ? this.toDraft(s.server) : [], errors: {}, message: null, conflict: false }));
  }

  save(kind: OutcomeKind): void {
    const s = this.state[kind]();
    if (!s.server) return;
    this.state[kind].set({ ...s, saving: true, errors: {}, message: null, conflict: false, saved: false });
    this.api.saveOutcomes(kind, {
      version: s.server.version,
      items: s.draft.map(o => ({ code: o.code, title: o.title.trim() || undefined, statement: o.statement })),
    }).subscribe({
      next: set => {
        this.state[kind].set({ ...blank(), server: set, draft: this.toDraft(set), saved: true });
        this.ctx?.refresh();
      },
      error: (e: WorkspaceError) => this.state[kind].update(x => ({
        ...x, saving: false, errors: e.fieldErrors ?? {}, message: e.message, conflict: e.errorCode === 'VERSION_CONFLICT',
      })),
    });
  }

  private toDraft(set: OutcomeSet): Draft[] {
    return set.items.map(o => ({ code: o.code, title: o.title ?? '', statement: o.statement }));
  }
}
