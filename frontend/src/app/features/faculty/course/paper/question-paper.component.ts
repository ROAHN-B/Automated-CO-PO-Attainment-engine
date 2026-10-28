import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, Subscription, of, switchMap, takeWhile, timer } from 'rxjs';
import {
  QP_BLOOM_LABEL, QP_BLOOM_LEVELS, QpAlignment, QpBloomLevel, QpPaper, QpQuestion, QpSheetFormat, QpSubQuestion, QpValidationResult,
  ValidatedSubQuestion, qpSubQuestionsOf,
} from '../../../../core/models/question-paper.model';
import { FacultyWorkspaceService, WorkspaceError } from '../../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../../shared/ui/icon.component';
import { categoryLabel } from '../../lifecycle';
import { CourseContext } from '../course-context';
import { PaperDraft, SubPath } from './paper-draft';

type View = 'paper' | 'review';
type Busy = 'save' | 'validate' | 'sheet' | 'confirm' | 'reopen' | null;

/** Poll QPV-1 every 2 s while the AI works, for at most 5 minutes (§2.7). */
const POLL_MS = 2000;
const POLL_LIMIT_MS = 5 * 60_000;

/**
 * Question paper validation (API_CONTRACT §10): the faculty types the paper —
 * questions, optional parts with a CO each, sub-questions with marks and the
 * expected Bloom level — then the AI checks it, the faculty downloads the
 * college's moderation sheet and confirms the paper, which generates the
 * read-only marksheet. Scores, alignments and the paper's
 * issues all come from the backend; this screen only shows them.
 */
@Component({
  selector: 'app-question-paper',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, DatePipe, RouterLink, IconComponent],
  templateUrl: './question-paper.component.html',
})
export class QuestionPaperComponent {
  private readonly api = inject(FacultyWorkspaceService);
  readonly ctx = inject(CourseContext);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly query = toSignal(this.route.queryParamMap);

  readonly draft = new PaperDraft();
  readonly paper = signal<QpPaper | null>(null);
  readonly result = signal<QpValidationResult | null>(null);
  readonly loadError = signal<WorkspaceError | null>(null);
  readonly actionError = signal<WorkspaceError | null>(null);
  readonly notice = signal('');
  readonly busy = signal<Busy>(null);
  readonly view = signal<View>('paper');
  readonly pollTimedOut = signal(false);
  readonly confirming = signal(false);
  readonly openRow = signal<string | null>(null);

  readonly bloomLevels = QP_BLOOM_LEVELS;
  readonly bloomLabel = QP_BLOOM_LABEL;
  private poll?: Subscription;

  readonly assessmentId = computed(() => this.query()?.get('assessment') ?? '');
  readonly cycle = computed(() =>
    this.ctx.offering()?.progress.cycles.find(c => c.assessmentId === this.assessmentId()) ?? null);
  readonly step = computed(() => this.cycle()?.steps.paperValidation ?? null);
  readonly kicker = computed(() => {
    const c = this.cycle();
    return c ? `${c.name} · ${categoryLabel(c.category)}` : 'Assessment cycle';
  });

  readonly status = computed(() => this.paper()?.status ?? null);
  readonly readOnly = computed(() => this.status() === 'FINALIZED' || this.status() === 'ANALYZING');
  /** The college's moderation sheet exists for ISE papers only (§10.7.7). */
  readonly hasSheet = computed(() => this.paper()?.examCategory === 'ISE'
    && (this.status() === 'ANALYSIS_READY' || this.status() === 'FINALIZED'));
  /** Reopening is allowed until the marksheet is finalized; the server decides (QPV-8). */
  readonly canReopen = computed(() => this.status() === 'FINALIZED' && this.cycle()?.steps.marksheet.status !== 'DONE');
  readonly hasReview = computed(() => !!this.result());
  /** Server issues describe the last save; after an edit they may be stale until the next save. */
  readonly issues = computed(() => this.paper()?.issues ?? []);
  readonly canValidate = computed(() => {
    const s = this.status();
    const dirty = this.draft.dirty();
    // A reviewed paper can be validated again once it's edited: the save returns it to DRAFT.
    const open = s === 'DRAFT' || s === 'ANALYSIS_FAILED' || (s === 'ANALYSIS_READY' && dirty);
    return open && (dirty || this.issues().length === 0) && this.draft.questions().length > 0;
  });
  readonly totalState = computed(() => {
    const total = this.draft.totalPreview();
    const max = Number(this.draft.header().maxMarks) || 0;
    return { total, max, matches: total === max && max > 0 };
  });

  readonly selectedCos = computed(() => {
    const ids = new Set(this.draft.coIds());
    return (this.paper()?.courseOutcomes ?? []).filter(c => ids.has(c.coId));
  });

  /** Rows for the review table, joined to the typed text by position in the paper. */
  readonly reviewRows = computed(() => {
    const r = this.result();
    const p = this.paper();
    if (!r || !p) return [];
    const typed = new Map<string, { q: QpQuestion; sub: QpSubQuestion }>();
    for (const q of p.questions) {
      for (const { part, sub } of qpSubQuestionsOf(q)) typed.set(this.rowKey(q.questionNo, part?.label, sub.label), { q, sub });
    }
    return r.subQuestions.map(v => {
      const key = this.rowKey(v.questionNo, v.partLabel, v.label);
      return { key, v, text: typed.get(key)?.sub.text ?? '', options: typed.get(key)?.sub.options ?? [], marks: typed.get(key)?.sub.marks ?? 0 };
    });
  });
  readonly flaggedCount = computed(() => (this.result()?.subQuestions ?? []).filter(v =>
    v.coAlignment !== 'ALIGNED' || v.bloomAlignment !== 'ALIGNED' || v.mcqCheck?.status === 'ISSUE' || v.flags?.length).length);
  readonly coverageMax = computed(() => Math.max(1, ...(this.result()?.coCoverage ?? []).map(c => c.marks)));
  readonly bloomMax = computed(() => Math.max(1, ...(this.result()?.bloomDistribution ?? []).map(b => b.marks)));

  constructor() {
    // Load once the course and its cycle are known; a locked step shows its reason instead.
    effect(() => {
      const id = this.assessmentId();
      const step = this.step();
      if (!id || !step || step.status === 'LOCKED') return;
      untracked(() => { if (this.paper()?.assessmentId !== id) this.load(); });
    });
    this.destroyRef.onDestroy(() => this.poll?.unsubscribe());
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.draft.dirty()) e.preventDefault();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirming() && this.busy() !== 'confirm') this.confirming.set(false);
  }

  load(): void {
    this.loadError.set(null);
    this.api.questionPaper(this.assessmentId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => this.take(p, true),
      error: (e: WorkspaceError) => this.loadError.set(e),
    });
  }

  /* --------------------------------- actions -------------------------------- */

  save(): void {
    this.run('save', this.saveIfDirty(), p => this.notice.set(p.issues.length
      ? `Draft saved. ${p.issues.length} ${p.issues.length === 1 ? 'thing needs' : 'things need'} fixing before validation.`
      : 'Draft saved. The paper is ready for validation.'));
  }

  /** Saves pending edits first, then asks for the AI check (QPV-3). */
  validate(): void {
    this.run('validate', this.saveIfDirty().pipe(switchMap(p => {
      if (p.issues.length) return of(p);
      return this.api.validateQuestionPaper(this.assessmentId(), p.version);
    })), p => {
      if (p.status === 'ANALYZING') this.notice.set('Sent to the AI. This usually takes under a minute.');
      else this.notice.set('Fix the problems listed below, then validate again.');
    });
  }

  /** QPV-5: the college's moderation sheet, for the hand-written moderation. */
  downloadSheet(format: QpSheetFormat): void {
    this.busy.set('sheet');
    this.actionError.set(null);
    this.api.moderationSheet(this.assessmentId(), format).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

  /** QPV-6: locks the paper and generates the read-only marksheet. */
  confirm(): void {
    this.run('confirm', this.api.confirmQuestionPaper(this.assessmentId(), this.paper()!.version), () => {
      this.confirming.set(false);
      this.notice.set('Paper confirmed. The marksheet is ready to check and finalize.');
      this.ctx.refresh();
    });
  }

  /** QPV-8: back to the review so the paper can be edited; the marksheet locks again. */
  reopen(): void {
    this.run('reopen', this.api.reopenQuestionPaper(this.assessmentId(), this.paper()!.version), () => {
      this.notice.set('Paper reopened. Edit it and validate again, then confirm it.');
      this.ctx.refresh();
    });
  }

  /** Editing an analysed paper returns it to draft on the next save (§10.5). */
  editPaper(): void {
    this.view.set('paper');
  }

  discardChanges(): void {
    const p = this.paper();
    if (p) this.draft.reset(p);
  }

  /** Turning the rule on starts at "any n − 1 of n", as on most papers. */
  toggleAttempt(qi: number, q: QpQuestion, on: boolean): void {
    this.draft.setAttempt(qi, on ? Math.max(1, qpSubQuestionsOf(q).length - 1) : null);
  }

  toggleRow(key: string): void {
    this.openRow.update(k => (k === key ? null : key));
  }

  /* --------------------------------- display -------------------------------- */

  coCode(coId: string | undefined): string {
    return this.paper()?.courseOutcomes.find(c => c.coId === coId)?.code ?? '—';
  }

  bloomNumber(level: QpBloomLevel): number {
    return QP_BLOOM_LEVELS.indexOf(level) + 1;
  }

  alignmentChip(a: QpAlignment): string {
    return a === 'ALIGNED' ? 'chip-met' : a === 'PARTIAL' ? 'chip-partial' : 'chip-gap';
  }

  alignmentText(a: QpAlignment): string {
    return a === 'ALIGNED' ? 'Aligned' : a === 'PARTIAL' ? 'Partly aligned' : 'Not aligned';
  }

  scoreTone(score: number): string {
    return score >= 80 ? 'text-met' : score >= 60 ? 'text-partial' : 'text-gap';
  }

  rowLabel(v: ValidatedSubQuestion): string {
    return `${v.questionNo}${v.partLabel ? ` (${v.partLabel})` : ''} (${v.label})`;
  }

  path(qi: number, pi: number | null, si: number): SubPath {
    return { qi, pi, si };
  }

  num(e: Event): number {
    return Number((e.target as HTMLInputElement).value);
  }

  text(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  flagText(flag: string): string {
    return flag.split('_').join(' ').toLowerCase();
  }

  /* -------------------------------- internals ------------------------------- */

  private rowKey(q: string, part: string | undefined, label: string): string {
    return `${q}|${part ?? ''}|${label}`;
  }

  private saveIfDirty(): Observable<QpPaper> {
    const p = this.paper()!;
    return this.draft.dirty() ? this.api.saveQuestionPaper(this.assessmentId(), this.draft.toUpdate(p.version)) : of(p);
  }

  private run(kind: Exclude<Busy, null>, source: Observable<QpPaper>, done: (p: QpPaper) => void): void {
    this.busy.set(kind);
    this.actionError.set(null);
    this.notice.set('');
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => { this.busy.set(null); this.take(p, false); done(p); },
      error: (e: WorkspaceError) => { this.busy.set(null); this.actionError.set(e); },
    });
  }

  /** Adopt the server's copy, fetch the review when there is one, and poll while analysing. */
  private take(p: QpPaper, first: boolean): void {
    const was = this.paper()?.status;
    this.paper.set(p);
    this.draft.reset(p);
    if (p.status === 'ANALYSIS_READY' || (p.status === 'FINALIZED' && p.questions.length)) {
      // Any edit clears the review below, so a missing one means a new analysis.
      if (!this.result()) this.fetchResult();
      if (first || was === 'ANALYZING') this.view.set('review');
    } else if (p.status !== 'FINALIZED') {
      this.result.set(null);
      if (p.status !== 'ANALYZING') this.view.set('paper');
    }
    if (p.status === 'ANALYZING') this.startPolling();
  }

  private fetchResult(): void {
    this.api.questionPaperResult(this.assessmentId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => this.result.set(r),
      error: (e: WorkspaceError) => this.actionError.set(e),
    });
  }

  private startPolling(): void {
    this.poll?.unsubscribe();
    this.pollTimedOut.set(false);
    const started = Date.now();
    this.poll = timer(POLL_MS, POLL_MS).pipe(
      switchMap(() => this.api.questionPaper(this.assessmentId(), 150)),
      takeWhile(p => p.status === 'ANALYZING' && Date.now() - started < POLL_LIMIT_MS, true),
    ).subscribe({
      next: p => {
        if (p.status !== 'ANALYZING') {
          this.take(p, false);
          this.notice.set(p.status === 'ANALYSIS_READY' ? 'The AI review is ready.' : '');
        } else if (Date.now() - started >= POLL_LIMIT_MS) {
          this.pollTimedOut.set(true);
        }
      },
      error: (e: WorkspaceError) => this.actionError.set(e),
    });
  }

  retryPolling(): void {
    this.startPolling();
  }
}
