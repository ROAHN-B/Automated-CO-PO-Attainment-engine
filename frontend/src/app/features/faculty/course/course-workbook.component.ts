import { DecimalPipe, NgClass } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { Page } from '../../../core/models/common.model';
import { CourseWorkbook, WorkbookBlock, WorkbookStudentRow } from '../../../core/models/faculty-workspace.model';
import { FacultyWorkspaceService, WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../shared/ui/icon.component';
import { CourseContext } from './course-context';

type SheetTab = 'MAIN' | 'POPSO' | 'DATA';

/**
 * Live course workbook (API_CONTRACT §14.4) — read-only for faculty.
 * The backend fills it all semester; this screen only renders the three
 * sheets and offers "Calculate CO-PO attainment" under blocks that are ready.
 */
@Component({
  selector: 'app-course-workbook',
  standalone: true,
  imports: [DecimalPipe, NgClass, RouterLink, IconComponent],
  templateUrl: './course-workbook.component.html',
})
export class CourseWorkbookComponent {
  private readonly api = inject(FacultyWorkspaceService);
  readonly ctx = inject(CourseContext);
  private readonly destroyRef = inject(DestroyRef);

  readonly tab = signal<SheetTab>('MAIN');
  readonly wb = signal<CourseWorkbook | null>(null);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);
  readonly notice = signal('');

  readonly students = signal<Page<WorkbookStudentRow> | null>(null);
  readonly studentsLoading = signal(false);
  readonly page = signal(0);
  readonly pageSize = 15;
  readonly search = signal('');
  private readonly search$ = new Subject<string>();

  /** Blocks whose marks are in and whose attainment is waiting — drives the hint banner. */
  readonly calculable = computed(() => this.wb()?.data.blocks.filter(b => b.canCalculate) ?? []);
  readonly ese = computed(() => {
    const c = this.wb()?.main.criteria;
    return c ? (this.wb()!.template === 'THEORY' ? c.ese.theory : c.ese.practical) : null;
  });

  constructor() {
    this.load();
    this.search$.pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef)).subscribe(term => {
      this.search.set(term);
      this.page.set(0);
      this.loadStudents();
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.workbook(this.ctx.offeringId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: wb => {
        this.wb.set(wb);
        this.loading.set(false);
        if (this.calculable().length) this.tab.set('DATA');
        this.loadStudents();
      },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  loadStudents(): void {
    this.studentsLoading.set(true);
    this.api.workbookStudents(this.ctx.offeringId(), this.page(), this.pageSize, this.search())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: p => { this.students.set(p); this.studentsLoading.set(false); },
        error: () => this.studentsLoading.set(false),
      });
  }

  onSearch(term: string): void { this.search$.next(term); }

  goToPage(p: number): void {
    this.page.set(p);
    this.loadStudents();
  }

  download(): void {
    this.notice.set('The .xlsx download (WB-3) is produced by the backend. It will be available once the backend is connected.');
  }

  /* ---- view helpers (presentation only) ---- */

  mark(row: WorkbookStudentRow, b: WorkbookBlock, label: string): string {
    const v = row.marks[b.assessmentId]?.[label];
    if (v === undefined || v === null) return '';
    return v === 'AB' ? 'AB' : String(v);
  }

  coLabel(q: WorkbookBlock['questions'][number]): string {
    return q.appliesToAllCos ? 'All' : q.coCodes.join(' + ');
  }

  blockStatusText(b: WorkbookBlock): string {
    return {
      AWAITING_MARKSHEET: 'Waiting for marksheet',
      AWAITING_UPLOAD: 'Waiting for lab upload',
      AWAITING_APPROVAL: 'Waiting for your approval',
      FILLED: b.attainmentApprovedRunId ? 'Attainment approved' : 'Marks approved',
      LOCKED: 'Locked',
    }[b.status];
  }

  pages(): number[] {
    const total = this.students()?.totalPages ?? 1;
    return Array.from({ length: total }, (_, i) => i);
  }
}
