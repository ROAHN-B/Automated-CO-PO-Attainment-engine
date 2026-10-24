import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ICONS, IconName } from './icons';

/**
 * Outline icon. Size it from the host:  <app-icon name="home" class="h-5 w-5" />
 * Decorative by default (aria-hidden); pass `label` when the icon stands alone.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block shrink-0' },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="stroke"
         class="block h-full w-full" [attr.aria-hidden]="label ? null : 'true'"
         [attr.role]="label ? 'img' : null" [attr.aria-label]="label || null">
      <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="d" />
    </svg>
  `,
})
export class IconComponent {
  @Input({ required: true }) name!: IconName;
  @Input() stroke = 1.5;
  @Input() label?: string;

  get d(): string {
    return ICONS[this.name];
  }
}
