import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AttainmentLevel } from '../../../core/models';

/**
 * LevelMeter — the app's signature attainment indicator.
 * Three segments fill according to the attainment level (0–3) and are coloured
 * by the semantic scale (gap / partial / met). Optionally shows a numeric read.
 *
 *   <app-level-meter [level]="co.attainmentLevel" [value]="co.finalAttainment" />
 *   <app-level-meter [level]="po.attainmentLevel" [value]="po.attainmentValue" suffix="" />
 */
@Component({
  selector: 'app-level-meter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inline-flex items-center gap-2.5">
      <div class="flex items-center gap-1" role="img" [attr.aria-label]="label">
        <span
          *ngFor="let seg of segments; let i = index"
          class="block rounded-sm transition-colors"
          [class.h-2.5]="size === 'sm'"
          [class.w-5]="size === 'sm'"
          [class.h-3]="size === 'md'"
          [class.w-7]="size === 'md'"
          [ngClass]="i < level ? fillClass : emptyClass"
        ></span>
      </div>

      <span *ngIf="value !== undefined" class="font-mono text-sm font-medium tnum" [ngClass]="textClass">
        {{ value | number: '1.0-1' }}{{ suffix }}
      </span>

      <span *ngIf="showLabel" class="text-xs font-medium" [ngClass]="textClass">{{ label }}</span>
    </div>
  `,
})
export class LevelMeterComponent {
  @Input() level: AttainmentLevel = 0;
  /** Optional numeric readout (e.g. 78.5 for %, or 2.6 for a PO value). */
  @Input() value?: number;
  @Input() suffix = '%';
  @Input() showLabel = false;
  @Input() size: 'sm' | 'md' = 'md';
  /**
   * Set on dark surfaces (e.g. the ink record header). The unfilled segments
   * default to `bg-line`, which is LIGHTER than the semantic fills — on navy
   * that inverts the reading, making empty slots louder than filled ones.
   */
  @Input() onDark = false;

  readonly segments = [0, 1, 2];

  get fillClass(): string {
    switch (this.level) {
      case 3: return 'bg-met';
      case 2: return 'bg-partial';
      case 1: return 'bg-gap';
      default: return 'bg-ink-faint';
    }
  }

  get emptyClass(): string {
    return this.onDark ? 'bg-white/15' : 'bg-line';
  }

  get textClass(): string {
    // The deepened semantics sit at ~3:1 on ink — fine for the segment bars
    // (non-text contrast) but not for a 12px label, so text goes white on dark.
    if (this.onDark) return 'text-white/80';
    switch (this.level) {
      case 3: return 'text-met';
      case 2: return 'text-partial';
      case 1: return 'text-gap';
      default: return 'text-ink-muted';
    }
  }

  get label(): string {
    switch (this.level) {
      case 3: return 'Level 3 · High';
      case 2: return 'Level 2 · Moderate';
      case 1: return 'Level 1 · Low';
      default: return 'Not attained';
    }
  }
}
