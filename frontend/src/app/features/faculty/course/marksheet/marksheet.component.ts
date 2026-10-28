import { NgClass } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AssessmentStructure, StructureQuestion } from '../../../../core/models/marksheet.model';
import { QP_BLOOM_LABEL, QP_BLOOM_LEVELS, QpBloomLevel } from '../../../../core/models/question-paper.model';
import { FacultyWorkspaceService, WorkspaceError } from '../../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../../shared/ui/icon.component';
import { categoryLabel } from '../../lifecycle';
import { CourseContext } from '../course-context';

type Busy = 'finalize' | 'template' | null;

/** One marksheet item as a workbook column: the question, its label, marks, COs and Bloom level. */
interface Column {
  questionNo: string;
  label: string;
  maxMarks: number;
  coCodes: string[];
  bloomLevel?: QpBloomLevel;
  firstOfQuestion: boolean;
  questionSpan: number;
}

/**
 * Marksheet (API_CONTRACT §12). For exams it's generated from the confirmed
 * question paper and is read-only; the faculty checks it and finalizes it,
 * which writes its columns into the course workbook and opens marks entry.
 * Totals and issues come from the backend.
 */
@Component({
  selector: 'app-marksheet',
  standalone: true,
  imports: [NgClass, RouterLink, IconComponent],
  templateUrl: './marksheet.component.html',
})
export class MarksheetComponent {
  private readonly api = inject(FacultyWorkspaceService);
  readonly ctx = inject(CourseContext);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly query = toSignal(this.route.queryParamMap);

  readonly sheet = signal<AssessmentStructure | null>(null);
  readonly loadError = signal<WorkspaceError | null>(null);
  readonly actionError = signal<WorkspaceError | null>(null);
  readonly notice = signal('');
  readonly busy = signal<Busy>(null);
  readonly confirming = signal(false);

  readonly bloomLabel = QP_BLOOM_LABEL;

  readonly assessmentId = computed(() => this.query()?.get('assessment') ?? '');
  readonly cycle = computed(() =>
    this.ctx.offering()?.progress.cycles.find(c => c.assessmentId === this.assessmentId()) ?? null);
  readonly step = computed(() => this.cycle()?.steps.marksheet ?? null);
  readonly kicker = computed(() => {
    const c = this.cycle();
    return c ? `${c.name} · ${categoryLabel(c.category)}` : 'Assessment cycle';
  });
  readonly finalized = computed(() => this.sheet()?.status === 'FINALIZED');
  readonly fromPaper = computed(() => this.sheet()?.source === 'QUESTION_PAPER');

  /** The marksheet laid out as the workbook's Data columns (presentation only). */
  readonly columns = computed<Column[]>(() => {
    const s = this.sheet();
    if (!s) return [];
    const code = (id: string) => s.courseOutcomes.find(c => c.coId === id)?.code ?? id;
    return s.questions.flatMap((q: StructureQuestion) => {
      const items = q.subQuestions?.length
        ? q.subQuestions.map(x => ({ label: x.label, maxMarks: x.maxMarks, coIds: x.coIds, bloomLevel: x.bloomLevel }))
        : [{ label: '', maxMarks: q.maxMarks ?? 0, coIds: q.coIds ?? [], bloomLevel: q.bloomLevel }];
      return items.map((x, i) => ({
        questionNo: q.questionNo, label: x.label, maxMarks: x.maxMarks, coCodes: x.coIds.map(code),
        bloomLevel: x.bloomLevel, firstOfQuestion: i === 0, questionSpan: items.length,
      }));
    });
  });
  readonly attemptRules = computed(() => (this.sheet()?.questions ?? [])
    .filter(q => q.attemptRule)
    .map(q => `${q.questionNo}: any ${q.attemptRule!.attempt} of ${q.attemptRule!.outOf}`));

  constructor() {
    effect(() => {
      const id = this.assessmentId();
      const step = this.step();
      if (!id || !step || step.status === 'LOCKED') return;
      untracked(() => { if (this.sheet()?.assessmentId !== id) this.load(); });
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirming() && this.busy() !== 'finalize') this.confirming.set(false);
  }

  load(): void {
    this.loadError.set(null);
    this.api.marksheet(this.assessmentId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: s => this.sheet.set(s),
      error: (e: WorkspaceError) => this.loadError.set(e),
    });
  }

  /** MS-3: the columns go into the workbook and marks entry opens. */
  finalize(): void {
    this.busy.set('finalize');
    this.actionError.set(null);
    this.api.finalizeMarksheet(this.assessmentId(), this.sheet()!.version).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: s => {
        this.busy.set(null);
        this.confirming.set(false);
        this.sheet.set(s);
        this.notice.set(`Marksheet finalized. Its ${this.columns().length} columns are in the workbook, and marks entry is open.`);
        this.ctx.refresh();
      },
      error: (e: WorkspaceError) => { this.busy.set(null); this.confirming.set(false); this.actionError.set(e); },
    });
  }

  /** MS-4 */
  downloadTemplate(): void {
    this.busy.set('template');
    this.actionError.set(null);
    this.api.marksheetTemplate(this.assessmentId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: f => {
        this.busy.set(null);
        const a = document.createElement('a');
        a.href = f.downloadUrl;
        a.download = f.fileName;
        a.rel = 'noopener';
        a.click();
        this.notice.set(`Downloaded ${f.fileName}.`);
      },
      error: (e: WorkspaceError) => { this.busy.set(null); this.actionError.set(e); },
    });
  }

  bloomNumber(level: QpBloomLevel): number {
    return QP_BLOOM_LEVELS.indexOf(level) + 1;
  }
}
