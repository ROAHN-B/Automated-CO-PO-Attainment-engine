import { NgClass } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SetupStepView } from '../setup-steps';

/**
 * Vertical stepper for the seven setup steps (API_CONTRACT §15.1). Locked steps
 * are visible but not clickable and say what unlocks them; the states come
 * from the backend.
 */
@Component({
  selector: 'app-setup-stepper',
  standalone: true,
  imports: [NgClass, RouterLink, RouterLinkActive, IconComponent],
  template: `
    @if (layout() === 'horizontal') {
      <nav aria-label="Semester setup steps">
        <ol class="flex flex-wrap items-center gap-x-1 gap-y-2">
          @for (s of steps(); track s.id; let last = $last) {
            <li class="flex items-center gap-1">
              @if (s.state.status === 'LOCKED') {
                <span class="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] text-ink-faint" [attr.title]="s.state.lockedReason">
                  <app-icon name="lock" class="h-3 w-3" /> {{ s.label }}
                </span>
              } @else {
                <a [routerLink]="['step', s.param]" routerLinkActive="!bg-paper-deep !font-semibold !text-ink"
                   #rla="routerLinkActive" [attr.aria-current]="rla.isActive ? 'step' : null"
                   class="flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] transition-colors duration-micro hover:bg-paper-deep"
                   [ngClass]="s.state.status === 'DONE' ? 'text-ink-soft' : 'text-ink'">
                  @if (s.state.status === 'DONE') {
                    <span class="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-white"><app-icon name="check" class="h-2.5 w-2.5" [stroke]="3" /></span>
                  } @else if (s.current) {
                    <span class="flex h-4 w-4 items-center justify-center rounded-full border-2 border-brand"><span class="h-1.5 w-1.5 rounded-full bg-brand"></span></span>
                  } @else {
                    <span class="text-xs font-semibold tnum text-ink-muted">{{ s.number }}</span>
                  }
                  {{ s.label }}
                </a>
              }
              @if (!last) { <app-icon name="chevronRight" class="h-3 w-3 text-ink-faint" /> }
            </li>
          }
        </ol>
      </nav>
    } @else {
    <nav aria-label="Semester setup steps">
      <ol class="space-y-0.5">
        @for (s of steps(); track s.id) {
          <li>
            @if (s.state.status === 'LOCKED') {
              <span class="flex items-start gap-3 rounded-md px-2 py-2" [attr.title]="s.state.lockedReason">
                <span class="mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-line text-ink-faint">
                  <app-icon name="lock" class="h-3 w-3" />
                </span>
                <span class="min-w-0">
                  <span class="block text-sm text-ink-muted">{{ s.label }}</span>
                  @if (s.state.lockedReason) { <span class="block text-xs text-ink-faint">{{ s.state.lockedReason }}</span> }
                </span>
              </span>
            } @else {
              <a [routerLink]="['step', s.param]" routerLinkActive="!bg-paper-deep"
                 #rla="routerLinkActive" [attr.aria-current]="rla.isActive ? 'step' : null"
                 class="flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-micro hover:bg-paper-deep">
                @if (s.state.status === 'DONE') {
                  <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ink text-white">
                    <app-icon name="check" class="h-3.5 w-3.5" [stroke]="2.5" />
                  </span>
                } @else if (s.current) {
                  <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand">
                    <span class="h-2 w-2 rounded-full bg-brand"></span>
                  </span>
                } @else {
                  <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-line text-xs font-semibold text-ink-soft tnum">{{ s.number }}</span>
                }
                <span class="min-w-0 flex-1 text-sm" [ngClass]="rla.isActive ? 'font-semibold text-ink' : s.state.status === 'DONE' ? 'text-ink-soft' : 'text-ink'">
                  {{ s.label }}
                </span>
                @if (s.current) { <span class="text-xs font-semibold text-brand">Now</span> }
              </a>
            }
          </li>
        }
      </ol>
    </nav>
    }
  `,
})
export class SetupStepperComponent {
  readonly steps = input.required<SetupStepView[]>();
  /** Vertical beside the step, or a horizontal strip above wide steps. */
  readonly layout = input<'vertical' | 'horizontal'>('vertical');
}
