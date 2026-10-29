import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SETUP_STEP_PURPOSE, stepFromParam } from '../setup-steps';
import { SetupContext } from './setup-context';

/** Sends …/semesters/:setupId to the step the coordinator should work on next. */
@Component({
  selector: 'app-setup-landing',
  standalone: true,
  template: `<div class="skeleton h-64" aria-busy="true" aria-label="Opening the current step"></div>`,
})
export class SetupLandingComponent {
  private readonly ctx = inject(SetupContext);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    effect(() => {
      const steps = this.ctx.steps();
      if (!steps.length) return;
      const target = this.ctx.current() ?? steps[steps.length - 1];
      this.router.navigate(['step', target.param], { relativeTo: this.route, replaceUrl: true });
    });
  }
}

/**
 * Landing screen for a setup step whose editor isn't built yet. It shows the
 * step's real state from the backend, so locks behave correctly.
 */
@Component({
  selector: 'app-setup-step',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    @if (step(); as st) {
      <div class="space-y-6 animate-enter">
        <header>
          <p class="page-kicker">Step {{ st.number }} of {{ ctx.steps().length }}</p>
          <h2 class="mt-1.5 font-serif text-[32px] font-light leading-tight text-ink">{{ st.label }}</h2>
          <p class="mt-2 max-w-2xl text-[15px] text-ink-soft">{{ purposes[st.id] }}</p>
        </header>

        @switch (st.state.status) {
          @case ('LOCKED') {
            <div class="alert alert-info">
              <app-icon name="lock" class="mt-0.5 h-4 w-4" />
              <div><p class="font-semibold text-ink">This step is locked</p><p class="mt-0.5">{{ st.state.lockedReason }}</p></div>
            </div>
          }
          @case ('DONE') {
            <div class="alert alert-info">
              <app-icon name="check" class="mt-0.5 h-4 w-4" [stroke]="2" />
              <p>This step is complete.</p>
            </div>
          }
          @default {
            <div class="alert alert-info">
              <app-icon name="clock" class="mt-0.5 h-4 w-4" />
              <p>{{ st.state.status === 'IN_PROGRESS' ? 'This step is in progress.' : 'This step is open.' }}</p>
            </div>
          }
        }

        <div class="card card-body text-sm text-ink-muted">
          The {{ st.label.toLowerCase() }} screen is being built. Its data contract is in
          <span class="font-mono text-[13px] text-ink-soft">API_CONTRACT.md</span> §15.
          <a routerLink="/faculty/coordination/semesters" class="link-accent ml-1">Back to all semesters</a>
        </div>
      </div>
    } @else {
      <div class="card empty-state"><p class="empty-title">Unknown step</p><a routerLink="/faculty/coordination/semesters" class="link-accent">Back to all semesters</a></div>
    }
  `,
})
export class SetupStepComponent {
  readonly ctx = inject(SetupContext);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  readonly purposes = SETUP_STEP_PURPOSE;
  readonly step = computed(() => {
    const id = stepFromParam(this.params()?.get('stepKey') ?? null);
    return id ? this.ctx.steps().find(s => s.id === id) ?? null : null;
  });
}
