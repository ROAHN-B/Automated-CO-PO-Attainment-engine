import { NgClass } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { OfferingProgress } from '../../../core/models/faculty-workspace.model';
import { IconComponent } from '../../../shared/ui/icon.component';
import { LifecycleGroup, groupStatus, lifecycleGroups } from '../lifecycle';

/**
 * Vertical lifecycle stepper (API_CONTRACT §7.1). Setup → one group per
 * assessment cycle → close-out. Locked steps are visible but not clickable and
 * explain what unlocks them. The active group is expanded; others collapse.
 */
@Component({
  selector: 'app-course-stepper',
  standalone: true,
  imports: [NgClass, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav aria-label="Course lifecycle">
      <ol class="space-y-1">
        @for (g of groups(); track g.id; let last = $last) {
          <li>
            <button type="button"
                    class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-micro hover:bg-paper-deep"
                    [attr.aria-expanded]="isOpen(g)" (click)="toggle(g)">
              <!-- Group marker -->
              @switch (status(g)) {
                @case ('DONE') {
                  <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ink text-white">
                    <app-icon name="check" class="h-3.5 w-3.5" [stroke]="2.5" />
                  </span>
                }
                @case ('ACTIVE') {
                  <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand">
                    <span class="h-2 w-2 rounded-full bg-brand"></span>
                  </span>
                }
                @default {
                  <span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-line text-ink-faint">
                    <app-icon name="lock" class="h-3 w-3" />
                  </span>
                }
              }
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold"
                      [ngClass]="status(g) === 'LOCKED' ? 'text-ink-muted' : 'text-ink'">
                  @if (g.order) { <span class="numeral mr-1.5 text-[15px]">{{ pad(g.order) }}</span> }{{ g.title }}
                </span>
                @if (g.subtitle) { <span class="block text-xs text-ink-muted">{{ g.subtitle }}</span> }
              </span>
              <app-icon name="chevronDown" class="h-4 w-4 text-ink-muted transition-transform duration-base"
                        [class.rotate-180]="isOpen(g)" />
            </button>

            @if (isOpen(g)) {
              <ol class="mb-2 ml-5 border-l border-line pl-4 animate-fade-in">
                @for (s of g.steps; track s.key) {
                  <li>
                    @if (s.state.status === 'LOCKED') {
                      <span class="flex items-start gap-2.5 py-1.5 text-[13px] text-ink-faint" [attr.title]="s.state.lockedReason">
                        <app-icon name="lock" class="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          <span class="block text-ink-muted">{{ s.label }}</span>
                          @if (s.state.lockedReason) { <span class="block text-xs text-ink-faint">{{ s.state.lockedReason }}</span> }
                        </span>
                      </span>
                    } @else {
                      <a [routerLink]="s.link.path" [queryParams]="s.link.query ?? null"
                         routerLinkActive="!bg-paper-deep !text-ink font-semibold" [routerLinkActiveOptions]="{ exact: false }"
                         class="-ml-1 flex items-center gap-2.5 rounded-md px-1 py-1.5 text-[13px] transition-colors duration-micro hover:bg-paper-deep"
                         [ngClass]="s.state.status === 'DONE' ? 'text-ink-soft' : 'text-ink'">
                        @if (s.state.status === 'DONE') {
                          <app-icon name="check" class="h-3.5 w-3.5 flex-shrink-0 text-ink" [stroke]="2.5" />
                        } @else {
                          <span class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center">
                            <span class="h-2 w-2 rounded-full bg-brand"></span>
                          </span>
                        }
                        <span class="flex-1">{{ s.label }}</span>
                        @if (s.state.status !== 'DONE') { <span class="text-xs font-semibold text-brand">Now</span> }
                      </a>
                    }
                  </li>
                }
              </ol>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class CourseStepperComponent {
  readonly progress = input.required<OfferingProgress>();

  readonly groups = computed(() => lifecycleGroups(this.progress()));
  /** Groups the user has explicitly toggled; otherwise only the active group is open. */
  private readonly toggled = signal<Record<string, boolean>>({});

  status(g: LifecycleGroup) { return groupStatus(g); }

  isOpen(g: LifecycleGroup): boolean {
    const t = this.toggled()[g.id];
    return t ?? this.status(g) === 'ACTIVE';
  }

  toggle(g: LifecycleGroup): void {
    this.toggled.update(m => ({ ...m, [g.id]: !this.isOpen(g) }));
  }

  pad(n: number): string { return n < 10 ? `0${n}` : String(n); }
}
