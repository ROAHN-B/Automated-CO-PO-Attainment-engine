import { NgClass, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, HostListener, PLATFORM_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { IconComponent } from '../icon.component';
import { ShellConfig } from './shell.config';

const COLLAPSE_KEY = 'obe.sidebar.collapsed';

/**
 * AppShellComponent — the one layout every portal uses.
 *
 * Routed as a parent component; its portal name, navigation and user card come
 * from the route's `data.shell` (see shell.config.ts), so adding a portal or a
 * nav entry never means writing another layout.
 *
 *   { path: 'faculty', component: AppShellComponent, data: { shell: FACULTY_SHELL }, children: [...] }
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="min-h-screen bg-paper">
      <div class="top-bar" aria-hidden="true"></div>
      <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-outline">
        Skip to content
      </a>

      <!-- Desktop sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface
               transition-[width] duration-base ease-smooth lg:flex"
        [style.width.px]="collapsed() ? 72 : 248">
        <ng-container *ngTemplateOutlet="sidebar; context: { $implicit: collapsed() }" />
      </aside>

      <!-- Mobile / tablet top bar -->
      <header class="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-paper/90 px-3 backdrop-blur lg:hidden">
        <button type="button" class="btn btn-ghost btn-icon" (click)="mobileOpen.set(true)"
                aria-label="Open navigation" [attr.aria-expanded]="mobileOpen()">
          <app-icon name="menu" class="h-5 w-5" />
        </button>
        <ng-container *ngTemplateOutlet="brand; context: { $implicit: false }" />
      </header>

      @if (mobileOpen()) {
        <div class="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div class="absolute inset-0 bg-ink/25 animate-fade-in" (click)="mobileOpen.set(false)"></div>
          <aside class="relative flex h-full w-[272px] max-w-[85vw] flex-col border-r border-line bg-surface shadow-pop animate-slide-in">
            <button type="button" class="btn btn-ghost btn-icon absolute right-2 top-3" (click)="mobileOpen.set(false)"
                    aria-label="Close navigation">
              <app-icon name="close" class="h-5 w-5" />
            </button>
            <ng-container *ngTemplateOutlet="sidebar; context: { $implicit: false }" />
          </aside>
        </div>
      }

      <main id="main" tabindex="-1" class="outline-none transition-[padding] duration-base ease-smooth"
            [ngClass]="collapsed() ? 'lg:pl-[72px]' : 'lg:pl-[248px]'">
        <div class="page-transition-root px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          <router-outlet />
        </div>
      </main>
    </div>

    <!-- Wordmark -->
    <ng-template #brand let-compact>
      @if (compact) {
        <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-ink font-serif text-[18px] font-light text-white"
              aria-label="OBE Engine">O</span>
      } @else {
        <div class="min-w-0 leading-none">
          <p class="truncate font-serif text-[22px] font-normal tracking-[-0.02em] text-ink">OBE Engine</p>
          <p class="mt-1 truncate text-xs font-medium text-brand">{{ config.portal }}</p>
        </div>
      }
    </ng-template>

    <!-- Sidebar body (shared by desktop rail and mobile drawer) -->
    <ng-template #sidebar let-compact>
      <div class="flex h-20 flex-shrink-0 items-center px-5" [class.justify-center]="compact" [class.px-0]="compact">
        <ng-container *ngTemplateOutlet="brand; context: { $implicit: compact }" />
      </div>

      <nav class="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        @for (section of config.sections; track $index) {
          <div [class.mt-6]="!$first" [class.mt-1]="$first">
            @if (section.label) {
              @if (compact) {
                <div class="mx-2 mb-3 h-px bg-line" role="separator"></div>
              } @else {
                <p class="px-3 pb-1.5 text-xs font-medium text-ink-muted">{{ section.label }}</p>
              }
            }
            <ul class="space-y-0.5">
              @for (item of section.items; track item.route) {
                <li>
                  <a class="sidebar-link" [class.justify-center]="compact" [class.px-0]="compact"
                     [routerLink]="item.route" routerLinkActive="sidebar-link-active"
                     #rla="routerLinkActive" [attr.aria-current]="rla.isActive ? 'page' : null"
                     [attr.title]="compact ? item.label : null" [attr.aria-label]="compact ? item.label : null">
                    <app-icon [name]="item.icon" class="h-[18px] w-[18px]" />
                    @if (!compact) { <span class="truncate">{{ item.label }}</span> }
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>

      <div class="flex-shrink-0 border-t border-line p-3">
        <div class="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5" [class.flex-col]="compact">
          <span class="avatar" [attr.title]="compact ? config.user.name : null">{{ config.user.initials }}</span>
          @if (!compact) {
            <div class="min-w-0 flex-1 leading-tight">
              <p class="truncate text-sm font-medium text-ink">{{ config.user.name }}</p>
              <p class="truncate text-xs text-ink-muted">{{ config.user.role }}</p>
            </div>
          }
          <button type="button" class="btn btn-ghost btn-icon h-8 w-8" (click)="logout()" aria-label="Sign out" title="Sign out">
            <app-icon name="logout" class="h-[18px] w-[18px]" />
          </button>
        </div>
        <button type="button"
                class="mt-1 hidden h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink-muted
                       transition-colors duration-micro hover:bg-ink/[0.04] hover:text-ink lg:flex"
                [class.justify-center]="compact" (click)="toggleCollapsed()"
                [attr.aria-label]="compact ? 'Expand sidebar' : 'Collapse sidebar'" [attr.aria-pressed]="compact">
          <app-icon name="sidebar" class="h-[18px] w-[18px]" />
          @if (!compact) { <span>Collapse</span> }
        </button>
      </div>
    </ng-template>
  `,
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly config: ShellConfig = inject(ActivatedRoute).snapshot.data['shell'];
  readonly collapsed = signal(this.readCollapsed());
  readonly mobileOpen = signal(false);

  constructor() {
    inject(Router).events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.mobileOpen.set(false));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.mobileOpen.set(false);
  }

  toggleCollapsed(): void {
    this.collapsed.update(v => !v);
    if (!this.isBrowser) return;
    try { localStorage.setItem(COLLAPSE_KEY, String(this.collapsed())); } catch { /* storage unavailable */ }
  }

  logout(): void {
    this.auth.logout();
  }

  private readCollapsed(): boolean {
    if (!this.isBrowser) return false;
    try { return localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch { return false; }
  }
}
