import { NgClass } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import {
  AllocatableSubject, AllocationBoard, AllocationStatus, FacultyLoad, FacultyMember, SubjectAllocation,
} from '../../../core/models/coordination.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SETUP_STEP_PURPOSE, roman } from '../setup-steps';
import { SetupContext } from '../setup/setup-context';

export const ALLOCATION_STATUS_LABEL: Record<AllocationStatus | 'UNASSIGNED', string> = {
  UNASSIGNED: 'Unassigned',
  DRAFT: 'Assigned',
  PENDING_ACCEPTANCE: 'Awaiting acceptance',
  ACCEPTED: 'Accepted',
};

/** A reassignment after completion emails both people, so it's confirmed first. */
interface PendingReassign { allocation: SubjectAllocation; to: FacultyMember; select: HTMLSelectElement }

/**
 * Step 6, Subject allocation (API_CONTRACT §15.6): one faculty member per
 * subject and division. "By subject" assigns; "By faculty" shows each person's
 * subjects and weekly hours across the year's semesters, to balance the load.
 */
@Component({
  selector: 'app-allocation',
  standalone: true,
  imports: [NgClass, RouterLink, IconComponent, BodyPortalDirective],
  templateUrl: './allocation.component.html',
})
export class AllocationComponent {
  private readonly api = inject(CoordinationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly ctx = inject(SetupContext);

  readonly purpose = SETUP_STEP_PURPOSE.ALLOCATION;
  readonly statusLabel = ALLOCATION_STATUS_LABEL;
  roman = roman;

  readonly view = signal<'subject' | 'faculty'>('subject');
  readonly board = signal<AllocationBoard | null>(null);
  readonly faculty = signal<FacultyMember[]>([]);
  readonly load = signal<FacultyLoad[]>([]);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busyKey = signal<string | null>(null);
  readonly confirming = signal<PendingReassign | null>(null);

  readonly stepState = computed(() => this.ctx.steps().find(s => s.id === 'ALLOCATION')?.state ?? null);
  readonly completed = computed(() => this.board()?.status === 'COMPLETED');
  readonly sections = computed(() => {
    const subjects = this.board()?.subjects ?? [];
    return [
      { key: 'THEORY', title: 'Theory courses', subjects: subjects.filter(s => s.section === 'THEORY') },
      { key: 'LABORATORY', title: 'Laboratory courses', subjects: subjects.filter(s => s.section === 'LABORATORY') },
    ].filter(s => s.subjects.length);
  });
  /** Weekly hours per faculty member this year, from the server (CRD-30). */
  readonly hoursOf = computed(() => new Map(this.load().map(l => [l.faculty.userId, l.weeklyHours])));
  readonly activeFaculty = computed(() => this.faculty().filter(f => f.status === 'ACTIVE'));

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    const yearId = this.ctx.setup()?.academicYear.academicYearId;
    forkJoin({
      board: this.api.allocationBoard(this.ctx.setupId()),
      faculty: this.api.facultyList({ size: 500 }),
      load: this.api.facultyLoad(yearId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this.board.set(r.board);
        this.faculty.set([...r.faculty.content].sort((a, b) => a.fullName.localeCompare(b.fullName)));
        this.load.set(r.load);
        this.loading.set(false);
      },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  key(s: AllocatableSubject, division?: string): string {
    return `${s.subjectKey}|${division ?? ''}`;
  }

  hours(s: AllocatableSubject): number {
    return s.hours.lecture + s.hours.tutorial + s.hours.practical;
  }

  status(a?: SubjectAllocation): AllocationStatus | 'UNASSIGNED' {
    return a?.status ?? 'UNASSIGNED';
  }

  isActive(userId: string): boolean {
    return this.activeFaculty().some(f => f.userId === userId);
  }

  facultyOption(f: FacultyMember): string {
    const h = this.hoursOf().get(f.userId) ?? 0;
    return `${f.fullName} · ${h} h/week`;
  }

  /** The faculty select changed for one subject and division. */
  choose(s: AllocatableSubject, division: string | undefined, current: SubjectAllocation | undefined, select: HTMLSelectElement): void {
    const userId = select.value;
    this.actionError.set(null);
    if (current && current.faculty.userId === userId) return;
    const k = this.key(s, division);
    if (!userId) {
      if (current) this.run(k, this.api.unallocate(current.allocationId));
      return;
    }
    if (!current) {
      this.run(k, this.api.allocate({ setupId: this.ctx.setupId(), subjectKey: s.subjectKey, division, facultyUserId: userId }));
      return;
    }
    const to = this.faculty().find(f => f.userId === userId);
    if (this.completed() && to) {
      this.confirming.set({ allocation: current, to, select });
      return;
    }
    this.run(k, this.api.reassign(current.allocationId, userId));
  }

  confirmReassign(): void {
    const p = this.confirming();
    if (!p) return;
    this.run(p.allocation.subjectKey + '|' + (p.allocation.division ?? ''), this.api.reassign(p.allocation.allocationId, p.to.userId),
      () => this.confirming.set(null));
  }

  cancelReassign(): void {
    const p = this.confirming();
    // Put the select back to the saved faculty member.
    if (p) p.select.value = p.allocation.faculty.userId;
    this.confirming.set(null);
  }

  private run(k: string, req$: Observable<unknown>, done?: () => void): void {
    this.busyKey.set(k);
    req$.subscribe({
      next: () => { this.busyKey.set(null); done?.(); this.refreshData(); },
      error: (e: WorkspaceError) => { this.busyKey.set(null); done?.(); this.actionError.set(e.message); this.refreshData(); },
    });
  }

  /** Re-read the board and the hours without the loading skeleton. */
  private refreshData(): void {
    const yearId = this.ctx.setup()?.academicYear.academicYearId;
    forkJoin({ board: this.api.allocationBoard(this.ctx.setupId()), load: this.api.facultyLoad(yearId) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: r => { this.board.set(r.board); this.load.set(r.load); } });
    this.ctx.refresh();
  }
}
