import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Moves its element to the end of <body> while it exists.
 *
 * The routed page sits inside `.page-transition-root`, whose view-transition
 * name makes it its own stacking context, so a fixed modal rendered there can't
 * rise above the sidebar: wide dialogs get clipped and the sidebar isn't
 * dimmed. Put this on a `.modal-backdrop`; Angular keeps managing its bindings.
 */
@Directive({ selector: '[appBodyPortal]', standalone: true })
export class BodyPortalDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly doc = inject(DOCUMENT);

  ngOnInit(): void {
    this.doc.body.appendChild(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.el.nativeElement.remove();
  }
}
