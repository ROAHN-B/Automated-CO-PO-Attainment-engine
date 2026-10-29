import { DatePipe, NgClass } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CourseGroup, LoadDistribution, LoadIssue, LoadRow, LoadTotals } from '../../../core/models/coordination.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SETUP_STEP_PURPOSE } from '../setup-steps';
import { SetupContext } from '../setup/setup-context';
import { LoadRowDialogComponent } from './load-row-dialog.component';
import { blankRow, dash, itemsSummary } from './load-helpers';

type Editing = { index: number | null; row: LoadRow };

/**
 * Step 3, Syllabus load distribution (API_CONTRACT §15.4): the semester's courses
 * in the college's table. Every change saves the whole table (CRD-20); totals and
 * issues come back from the server.
 */
@Component({
  selector: 'app-load-distribution',
  standalone: true,
  imports: [DatePipe, NgClass, RouterLink, IconComponent, BodyPortalDirective, LoadRowDialogComponent],
  templateUrl: './load-distribution.component.html',
})
export class LoadDistributionComponent {
  private readonly api = inject(CoordinationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly ctx = inject(SetupContext);

  readonly purpose = SETUP_STEP_PURPOSE.SYLLABUS;
  dash = dash;
  itemsSummary = itemsSummary;

  readonly load = signal<LoadDistribution | null>(null);
  readonly groups = signal<CourseGroup[]>([]);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<WorkspaceError | null>(null);
  readonly editing = signal<Editing | null>(null);
  readonly deleting = signal<number | null>(null);

  readonly stepState = computed(() => this.ctx.steps().find(s => s.id === 'SYLLABUS')?.state ?? null);
  readonly readOnly = computed(() => this.load()?.status === 'DECLARED' || this.stepState()?.status === 'LOCKED');
  readonly sections = computed(() => {
    const rows = this.load()?.rows ?? [];
    const withIndex = rows.map((row, index) => ({ row, index }));
    return [
      { key: 'THEORY' as const, title: 'Theory courses', rows: withIndex.filter(x => x.row.section === 'THEORY') },
      { key: 'LABORATORY' as const, title: 'Laboratory courses', rows: withIndex.filter(x => x.row.section === 'LABORATORY') },
    ];
  });
  /** Issues not tied to one row (e.g. an empty table). */
  readonly generalIssues = computed(() => (this.load()?.issues ?? []).filter(i => !i.rowId));

  constructor() {
    this.api.courseGroups().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: g => this.groups.set(g) });
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.saveError.set(null);
    this.api.loadDistribution(this.ctx.setupId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: l => { this.load.set(l); this.loading.set(false); },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  issuesFor(rowId?: string): LoadIssue[] {
    return rowId ? (this.load()?.issues ?? []).filter(i => i.rowId === rowId) : [];
  }

  sectionTotals(key: 'THEORY' | 'LABORATORY'): LoadTotals | null {
    const t = this.load()?.totals;
    return t ? (key === 'THEORY' ? t.theory : t.laboratory) : null;
  }

  groupName(code: string): string {
    return this.groups().find(g => g.code === code)?.name ?? code;
  }

  /* ---- editing: every change saves the whole table ---- */

  add(section: LoadRow['section']): void {
    this.saveError.set(null);
    this.editing.set({ index: null, row: blankRow(section) });
  }

  edit(index: number): void {
    const row = this.load()?.rows[index];
    if (row) { this.saveError.set(null); this.editing.set({ index, row }); }
  }

  /** Opens the row an issue points at. */
  editRow(rowId: string): void {
    this.edit(this.load()?.rows.findIndex(r => r.rowId === rowId) ?? -1);
  }

  onApplied(row: LoadRow): void {
    const e = this.editing();
    const rows = [...(this.load()?.rows ?? [])];
    if (!e) return;
    if (e.index === null) {
      // New rows go at the end of their section.
      const lastOfSection = rows.map(r => r.section).lastIndexOf(row.section);
      rows.splice(lastOfSection < 0 ? (row.section === 'THEORY' ? 0 : rows.length) : lastOfSection + 1, 0, row);
    } else {
      rows.splice(e.index, 1, row);
      // A row moved to the other section goes to the end of it.
      if (rows[e.index].section !== this.load()!.rows[e.index].section) {
        rows.splice(e.index, 1);
        const last = rows.map(r => r.section).lastIndexOf(row.section);
        rows.splice(last < 0 ? (row.section === 'THEORY' ? 0 : rows.length) : last + 1, 0, row);
      }
    }
    this.save(rows, () => this.editing.set(null));
  }

  move(index: number, step: -1 | 1): void {
    const rows = [...(this.load()?.rows ?? [])];
    const section = rows[index].section;
    let j = index + step;
    while (j >= 0 && j < rows.length && rows[j].section !== section) j += step;
    if (j < 0 || j >= rows.length) return;
    [rows[index], rows[j]] = [rows[j], rows[index]];
    this.save(rows);
  }

  canMove(index: number, step: -1 | 1): boolean {
    const rows = this.load()?.rows ?? [];
    const section = rows[index]?.section;
    return rows.some((r, i) => r.section === section && (step < 0 ? i < index : i > index));
  }

  remove(index: number): void {
    const rows = [...(this.load()?.rows ?? [])];
    rows.splice(index, 1);
    this.save(rows, () => this.deleting.set(null));
  }

  private save(rows: LoadRow[], done?: () => void): void {
    const l = this.load();
    if (!l) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.api.saveLoadDistribution(this.ctx.setupId(), { version: l.version, rows }).subscribe({
      next: saved => {
        this.saving.set(false);
        this.load.set(saved);
        done?.();
        this.ctx.refresh();
      },
      error: (e: WorkspaceError) => { this.saving.set(false); this.saveError.set(e); },
    });
  }
}
