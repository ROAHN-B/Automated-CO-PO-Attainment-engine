import { DatePipe, NgClass } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AllocationBlockerCode, AllocationBoard, AllocationNotification, SubjectAllocation,
} from '../../../core/models/coordination.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SETUP_STEP_PURPOSE } from '../setup-steps';
import { SetupContext } from '../setup/setup-context';
import { ALLOCATION_STATUS_LABEL } from './allocation.component';

const CHECKS: { code: AllocationBlockerCode; ok: string; todo: string; fix: string }[] = [
  { code: 'SYLLABUS_NOT_DECLARED', ok: 'The syllabus is declared', todo: 'The syllabus isn’t declared yet', fix: '../declaration' },
  { code: 'OUTCOMES_INCOMPLETE', ok: 'The 11 POs and 3 PSOs are filled', todo: 'The POs and PSOs aren’t all filled', fix: '../outcomes' },
  { code: 'UNASSIGNED', ok: 'Every subject has a faculty member', todo: 'Some subjects have no faculty member', fix: '../allocation' },
  { code: 'INACTIVE_FACULTY', ok: 'Every allocated faculty member is active', todo: 'Some subjects are given to inactive faculty', fix: '../allocation' },
];

const KIND_LABEL: Record<AllocationNotification['kind'], string> = {
  ALLOCATION: 'Allocation', REASSIGNED: 'New subject', REMOVED: 'Subject reassigned', REMINDER: 'Reminder',
};

/**
 * Step 7, Complete and notify (API_CONTRACT §15.7): the server's checks, then
 * "Complete allocation" (CRD-31), which emails each faculty member once. After
 * that the step tracks who has accepted (FAC-4), sends reminders (CRD-32) and
 * lists every email sent (CRD-33).
 */
@Component({
  selector: 'app-complete-allocation',
  standalone: true,
  imports: [DatePipe, NgClass, RouterLink, IconComponent, BodyPortalDirective],
  template: `
    <div class="space-y-6 animate-enter">
      <header>
        <p class="page-kicker">Step 7 of {{ ctx.steps().length || 7 }}</p>
        <h2 class="mt-1.5 font-serif text-[32px] font-light leading-tight text-ink">Complete and notify</h2>
        <p class="mt-2 max-w-2xl text-[15px] text-ink-soft">{{ purpose }}</p>
      </header>

      @if (loading() && !board()) {
        <div class="skeleton h-72" aria-busy="true" aria-label="Loading"></div>
      } @else if (error()) { @let e = error()!;
        <div class="alert alert-error" role="alert">
          <app-icon name="alert" class="mt-0.5 h-4 w-4" />
          <div class="flex-1"><p class="font-semibold">Couldn’t load the allocation</p><p class="mt-0.5">{{ e.message }}</p></div>
          <button type="button" class="btn btn-outline btn-sm" (click)="reload()">Try again</button>
        </div>
      } @else if (board()) { @let b = board()!;

        @if (b.status !== 'COMPLETED') {
          <!-- Checks before completing -->
          <section class="card" aria-labelledby="cp-checks">
            <h3 id="cp-checks" class="border-b border-line px-6 py-4 text-[15px] font-semibold text-ink">Before the faculty are emailed</h3>
            <ul class="divide-y divide-line-soft">
              @for (c of checks; track c.code) { @let open = blockersOf(c.code);
                <li class="flex items-start gap-3 px-6 py-3.5">
                  @if (open.length) {
                    <span class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-gap text-gap"><app-icon name="close" class="h-3 w-3" [stroke]="2.5" /></span>
                  } @else {
                    <span class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-ink text-white"><app-icon name="check" class="h-3 w-3" [stroke]="2.5" /></span>
                  }
                  <div class="min-w-0 flex-1 text-sm">
                    <p [ngClass]="open.length ? 'font-semibold text-ink' : 'text-ink-soft'">
                      {{ open.length ? c.todo : c.ok }}
                      @if (c.code === 'UNASSIGNED') { <span class="font-normal text-ink-muted">({{ b.summary.assigned }} of {{ b.summary.subjects }} assigned)</span> }
                    </p>
                    @if (open.length && (c.code === 'UNASSIGNED' || c.code === 'INACTIVE_FACULTY')) {
                      <ul class="mt-1 space-y-0.5 text-[13px] text-ink-muted">
                        @for (x of open.slice(0, 5); track $index) { <li>{{ x.message }}</li> }
                        @if (open.length > 5) { <li>…and {{ open.length - 5 }} more</li> }
                      </ul>
                    }
                  </div>
                  @if (open.length) { <a class="link-accent flex-shrink-0 text-sm" [routerLink]="c.fix">Fix</a> }
                </li>
              }
            </ul>
          </section>

          @if (actionError()) {
            <div class="alert alert-error" role="alert">
              <app-icon name="alert" class="mt-0.5 h-4 w-4" />
              <p class="flex-1">{{ actionError() }}</p>
            </div>
          }

          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-ink-muted">
              @if (b.blockers.length) { Fix the items above to complete the allocation. }
              @else { Everything is ready. Each faculty member gets one email listing their subjects. }
            </p>
            <button type="button" class="btn btn-primary" [disabled]="b.blockers.length > 0" (click)="confirming.set(true)">Complete allocation</button>
          </div>
        } @else {
          <!-- Completed: track acceptance -->
          <div class="alert alert-info">
            <app-icon name="check" class="mt-0.5 h-4 w-4" [stroke]="2" />
            <p>Allocation completed {{ b.completedAt | date: 'd MMM y, h:mm a' }}. {{ b.summary.accepted }} of {{ b.summary.subjects }} subjects accepted so far.</p>
          </div>

          @if (actionError()) {
            <div class="alert alert-error" role="alert">
              <app-icon name="alert" class="mt-0.5 h-4 w-4" />
              <p class="flex-1">{{ actionError() }}</p>
            </div>
          }
          @if (notice()) {
            <p class="text-sm text-ink-soft" role="status">{{ notice() }}</p>
          }

          <section class="card overflow-hidden" aria-labelledby="cp-track">
            <h3 id="cp-track" class="border-b border-line px-6 py-4 text-[15px] font-semibold text-ink">Acceptance</h3>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="th">Subject</th>
                    <th class="th">Faculty member</th>
                    <th class="th">Status</th>
                    <th class="th">Emailed</th>
                    <th class="th"><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (a of allocations(); track a.allocationId) {
                    <tr>
                      <td class="td">
                        <p class="font-medium text-ink">{{ a.course.courseName }}@if (a.division) { <span class="text-ink-muted"> · Div {{ a.division }}</span> }</p>
                        <p class="font-mono text-[12px] text-ink-muted">{{ a.course.courseCode }}</p>
                      </td>
                      <td class="td text-ink">{{ a.faculty.fullName }}</td>
                      <td class="td whitespace-nowrap">
                        <span class="chip" [ngClass]="a.status === 'ACCEPTED' ? 'chip-neutral' : 'chip-brand'">
                          @if (a.status === 'ACCEPTED') { <app-icon name="check" class="h-3 w-3" [stroke]="2.5" /> }
                          {{ statusLabel[a.status] }}
                        </span>
                        @if (a.acceptedAt) { <span class="mt-0.5 block text-xs text-ink-muted">{{ a.acceptedAt | date: 'd MMM, h:mm a' }}</span> }
                      </td>
                      <td class="td whitespace-nowrap text-[13px]">{{ a.notifiedAt | date: 'd MMM, h:mm a' }}</td>
                      <td class="td text-right">
                        @if (a.status === 'PENDING_ACCEPTANCE') {
                          <button type="button" class="btn btn-ghost btn-sm" [disabled]="busyId() === a.allocationId" (click)="remind(a)"
                                  [attr.aria-label]="'Remind ' + a.faculty.fullName + ' about ' + a.course.courseName">
                            @if (busyId() === a.allocationId) { <span class="spinner"></span> } @else { Remind }
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <!-- Emails -->
        @if (mails().length) {
          <section class="card" aria-labelledby="cp-mail">
            <h3 id="cp-mail" class="border-b border-line px-6 py-4 text-[15px] font-semibold text-ink">Emails sent ({{ mails().length }})</h3>
            <ul class="divide-y divide-line-soft">
              @for (m of mails(); track m.notificationId) {
                <li>
                  <button type="button" class="flex w-full items-start justify-between gap-3 px-6 py-3 text-left hover:bg-paper-deep/60"
                          [attr.aria-expanded]="openMail() === m.notificationId" (click)="toggleMail(m.notificationId)">
                    <span class="min-w-0">
                      <span class="block text-sm text-ink">{{ m.to.fullName }} <span class="text-ink-muted">· {{ m.to.email }}</span></span>
                      <span class="block text-[13px] text-ink-muted">{{ m.subjectLine }}</span>
                    </span>
                    <span class="flex flex-shrink-0 items-center gap-2 text-xs text-ink-muted">
                      <span class="chip chip-neutral">{{ kindLabel[m.kind] }}</span>
                      @if (m.includesSetPasswordLink) { <span class="chip chip-neutral">Set-password link</span> }
                      {{ m.status === 'SENT' ? 'Sent' : m.status === 'QUEUED' ? 'Queued' : 'Failed' }} {{ m.createdAt | date: 'h:mm a' }}
                      <app-icon name="chevronDown" class="h-4 w-4 transition-transform" [class.rotate-180]="openMail() === m.notificationId" />
                    </span>
                  </button>
                  @if (openMail() === m.notificationId) {
                    <pre class="mx-6 mb-4 whitespace-pre-wrap rounded-lg border border-line bg-paper-deep/50 p-4 font-sans text-[13px] leading-relaxed text-ink-soft">{{ m.body }}</pre>
                  }
                </li>
              }
            </ul>
          </section>
        }
      }
    </div>

    @if (confirming()) {
      <div class="modal-backdrop" appBodyPortal (click)="busy() || confirming.set(false)">
        <div class="modal max-w-md" role="dialog" aria-modal="true" aria-labelledby="cp-confirm-title" (click)="$event.stopPropagation()">
          <div class="p-6">
            <h3 id="cp-confirm-title" class="font-serif text-2xl font-light text-ink">Complete the allocation?</h3>
            <p class="mt-3 text-sm leading-relaxed text-ink-soft">
              {{ board()?.summary?.subjects }} subjects go to {{ facultyCount() }} faculty members, and each of them gets one email listing their subjects.
              Anyone who hasn’t signed in yet gets a link to set a password. Each subject then waits for its faculty member to accept it.
            </p>
            <p class="mt-3 text-sm text-ink-soft">The syllabus and the divisions can’t change after this.</p>
          </div>
          <div class="flex justify-end gap-2 border-t border-line px-6 py-4">
            <button type="button" class="btn btn-ghost" [disabled]="busy()" (click)="confirming.set(false)">Cancel</button>
            <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="complete()">
              @if (busy()) { <span class="spinner"></span> Completing… } @else { Complete and send emails }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CompleteAllocationComponent {
  private readonly api = inject(CoordinationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly ctx = inject(SetupContext);

  readonly purpose = SETUP_STEP_PURPOSE.COMPLETE;
  readonly checks = CHECKS;
  readonly statusLabel = ALLOCATION_STATUS_LABEL;
  readonly kindLabel = KIND_LABEL;

  readonly board = signal<AllocationBoard | null>(null);
  readonly mails = signal<AllocationNotification[]>([]);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly confirming = signal(false);
  readonly busy = signal(false);
  readonly busyId = signal<string | null>(null);
  readonly openMail = signal<string | null>(null);

  readonly allocations = computed<SubjectAllocation[]>(() =>
    (this.board()?.subjects ?? []).flatMap(s => s.divisions.map(d => d.allocation).filter((a): a is SubjectAllocation => !!a)));
  readonly facultyCount = computed(() => new Set(this.allocations().map(a => a.faculty.userId)).size);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ board: this.api.allocationBoard(this.ctx.setupId()), mails: this.api.notifications(this.ctx.setupId()) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: r => { this.board.set(r.board); this.mails.set(r.mails); this.loading.set(false); },
        error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
      });
  }

  blockersOf(code: AllocationBlockerCode) {
    return (this.board()?.blockers ?? []).filter(b => b.code === code);
  }

  complete(): void {
    const b = this.board();
    if (!b) return;
    this.busy.set(true);
    this.actionError.set(null);
    this.api.completeAllocation(b.setupId, b.version).subscribe({
      next: () => { this.busy.set(false); this.confirming.set(false); this.ctx.refresh(); this.reload(); },
      error: (e: WorkspaceError) => { this.busy.set(false); this.confirming.set(false); this.actionError.set(e.message); this.reload(); },
    });
  }

  remind(a: SubjectAllocation): void {
    this.busyId.set(a.allocationId);
    this.actionError.set(null);
    this.api.remind(a.allocationId).subscribe({
      next: () => { this.busyId.set(null); this.notice.set(`Reminder sent to ${a.faculty.fullName}.`); this.reload(); },
      error: (e: WorkspaceError) => { this.busyId.set(null); this.actionError.set(e.message); },
    });
  }

  toggleMail(id: string): void {
    this.openMail.update(x => (x === id ? null : id));
  }
}
