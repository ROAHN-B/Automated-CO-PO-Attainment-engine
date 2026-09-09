import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  BLOOM_LABELS,
  BLOOM_LEVELS,
  BloomLevel,
  BlueprintRow,
  Course,
  CourseOutcome,
  GeneratedQuestion,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  QuestionGenerationRequest,
  QuestionGenerationResponse,
  QuestionPaper,
  QuestionPaperRequest,
  QuestionType,
  SyllabusUnit,
} from '../../core/models';
import { AiGenerationService } from '../../core/services/ai-generation.service';
import { CourseService } from '../../core/services/course.service';

/** Marks offered in the blueprint step. */
const MARK_OPTIONS = [1, 2, 4, 6, 10];

/** Sensible default type per weight — objective at low marks, descriptive at high. */
const DEFAULT_TYPE_BY_MARK: Record<number, QuestionType> = {
  1: 'MCQ',
  2: 'FILL_IN_THE_BLANK',
  4: 'SHORT_ANSWER',
  6: 'LONG_ANSWER',
  10: 'LONG_ANSWER',
};

/**
 * QuestionGeneratorWizardComponent — Part 3, the streamlined 6-step wizard.
 * NO file upload here: units are already embedded via the Knowledge Base. The
 * flow is unit → blueprint → outcomes → generate (LLM) → review → export.
 */
@Component({
  selector: 'app-question-generator-wizard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './question-generator-wizard.component.html',
})
export class QuestionGeneratorWizardComponent {
  private readonly ai = inject(AiGenerationService);
  private readonly courseSvc = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly steps = ['Unit', 'Blueprint', 'Outcomes', 'Generate', 'Review', 'Export'];
  readonly markOptions = MARK_OPTIONS;
  readonly bloomLevels = BLOOM_LEVELS;
  readonly bloomLabels = BLOOM_LABELS;
  readonly questionTypes = QUESTION_TYPES;
  readonly questionTypeLabels = QUESTION_TYPE_LABELS;

  /* ------------------------------- state ------------------------------- */
  readonly step = signal(1); // 1..6

  readonly courses = signal<Course[]>([]);
  readonly courseId = signal('');
  readonly units = signal<SyllabusUnit[]>([]);
  readonly unitId = signal('');

  readonly counts = signal<Record<number, number>>({ 1: 0, 2: 5, 4: 0, 6: 3, 10: 0 });
  readonly types = signal<Record<number, QuestionType>>({ ...DEFAULT_TYPE_BY_MARK });

  readonly outcomes = signal<CourseOutcome[]>([]);
  readonly selectedCoIds = signal<string[]>([]);
  readonly bloomFilter = signal<BloomLevel[]>([]);
  readonly instructions = signal('');

  readonly generating = signal(false);
  readonly generation = signal<QuestionGenerationResponse | null>(null);
  readonly questions = signal<GeneratedQuestion[]>([]);
  readonly editingId = signal<string | null>(null);

  readonly paperTitle = signal('');
  readonly examName = signal('');
  readonly durationMinutes = signal<number | null>(90);
  readonly paperInstructions = signal('All questions are compulsory. Figures to the right indicate full marks.');
  readonly building = signal(false);
  readonly paper = signal<QuestionPaper | null>(null);

  /* ----------------------------- computed ----------------------------- */
  readonly selectedUnit = computed(() => this.units().find(u => u.unitId === this.unitId()) ?? null);
  readonly selectedCourse = computed(() => this.courses().find(c => c.courseId === this.courseId()) ?? null);

  readonly blueprint = computed<BlueprintRow[]>(() =>
    MARK_OPTIONS
      .filter(m => (this.counts()[m] ?? 0) > 0)
      .map(m => ({ marks: m, count: this.counts()[m], questionType: this.types()[m] })),
  );
  readonly totalQuestions = computed(() => this.blueprint().reduce((s, d) => s + d.count, 0));
  readonly totalMarks = computed(() => this.blueprint().reduce((s, d) => s + d.marks * d.count, 0));

  readonly keptQuestions = computed(() => this.questions().filter(q => q.selected));
  readonly keptMarks = computed(() => this.keptQuestions().reduce((s, q) => s + q.marks, 0));

  /** Review questions grouped by mark weight (highest first) — reads like a paper. */
  readonly groups = computed(() => {
    const qs = this.questions();
    const marks = [...new Set(qs.map(q => q.marks))].sort((a, b) => b - a);
    return marks.map(m => ({ marks: m, questions: qs.filter(q => q.marks === m) }));
  });

  constructor() {
    this.courseSvc.getCourses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(cs => {
      this.courses.set(cs);
      if (cs.length && !this.courseId()) this.onCourseChange(cs[0].courseId);
    });
  }

  /* ------------------------------ loaders ----------------------------- */

  onCourseChange(id: string): void {
    this.courseId.set(id);
    this.unitId.set('');
    this.selectedCoIds.set([]);
    this.ai.getUnits(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(u => this.units.set(u));
    this.courseSvc.getCourseOutcomes(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(o => this.outcomes.set(o));
  }

  /* --------------------------- step 1: unit --------------------------- */
  pickUnit(u: SyllabusUnit): void {
    if (!u.isEmbedded) return;
    this.unitId.set(u.unitId);
  }

  /* ------------------------ step 2: blueprint ------------------------- */
  adjust(marks: number, delta: number): void {
    const current = this.counts()[marks] ?? 0;
    const next = Math.max(0, Math.min(20, current + delta));
    this.counts.set({ ...this.counts(), [marks]: next });
  }
  setCount(marks: number, value: number): void {
    const n = Math.max(0, Math.min(20, Math.floor(value || 0)));
    this.counts.set({ ...this.counts(), [marks]: n });
  }
  /** Set the question format for a given mark-weight row. */
  setType(marks: number, type: QuestionType): void {
    this.types.set({ ...this.types(), [marks]: type });
  }

  /* ------------------------- step 3: outcomes ------------------------- */
  toggleCo(coId: string): void {
    const set = new Set(this.selectedCoIds());
    set.has(coId) ? set.delete(coId) : set.add(coId);
    this.selectedCoIds.set([...set]);
  }
  isCoSelected(coId: string): boolean { return this.selectedCoIds().includes(coId); }

  toggleBloom(level: BloomLevel): void {
    const set = new Set(this.bloomFilter());
    set.has(level) ? set.delete(level) : set.add(level);
    this.bloomFilter.set([...set]);
  }
  isBloomSelected(level: BloomLevel): boolean { return this.bloomFilter().includes(level); }

  /* -------------------------- step 4: generate ------------------------ */
  generate(): void {
    const req: QuestionGenerationRequest = {
      courseId: this.courseId(),
      unitId: this.unitId(),
      coIds: this.selectedCoIds(),
      blueprint: this.blueprint(),
      bloomLevels: this.bloomFilter().length ? this.bloomFilter() : undefined,
      additionalInstructions: this.instructions().trim() || undefined,
    };
    this.step.set(4);
    this.generating.set(true);
    this.ai.generateQuestions(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.generation.set(res);
        this.questions.set(res.questions);
        this.generating.set(false);
        this.step.set(5);
      },
      error: () => { this.generating.set(false); this.step.set(3); },
    });
  }

  regenerate(): void {
    this.questions.set([]);
    this.generation.set(null);
    this.generate();
  }

  /* --------------------------- step 5: review ------------------------- */
  toggleQuestion(id: string): void {
    this.questions.set(this.questions().map(q => q.questionId === id ? { ...q, selected: !q.selected } : q));
  }
  setAll(selected: boolean): void {
    this.questions.set(this.questions().map(q => ({ ...q, selected })));
  }
  startEdit(id: string): void { this.editingId.set(id); }
  saveEdit(id: string, text: string): void {
    this.questions.set(this.questions().map(q => q.questionId === id ? { ...q, questionText: text, status: 'EDITED' } : q));
    this.editingId.set(null);
  }

  /* --------------------------- step 6: export ------------------------- */
  buildPaper(): void {
    if (!this.generation() || this.keptQuestions().length === 0 || !this.paperTitle().trim()) return;
    const req: QuestionPaperRequest = {
      generationId: this.generation()!.generationId,
      courseId: this.courseId(),
      title: this.paperTitle().trim(),
      selectedQuestionIds: this.keptQuestions().map(q => q.questionId),
      examName: this.examName().trim() || undefined,
      durationMinutes: this.durationMinutes() ?? undefined,
      instructions: this.paperInstructions().trim() || undefined,
    };
    this.building.set(true);
    this.ai.exportQuestionPaper(req, this.keptQuestions()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => { this.paper.set(p); this.building.set(false); },
      error: () => this.building.set(false),
    });
  }

  /**
   * Download the paper. With a real backend Abhijeet returns a hosted `pdfUrl`;
   * in mock mode we render a print-optimised view and let the browser save PDF.
   */
  downloadPdf(): void {
    const paper = this.paper();
    if (!paper || !this.isBrowser) return;

    if (paper.pdfUrl) { window.open(paper.pdfUrl, '_blank'); return; }

    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) return;
    win.document.write(this.printableHtml(paper));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  }

  private printableHtml(paper: QuestionPaper): string {
    const course = this.selectedCourse();
    const rows = paper.questions
      .map((q, i) => {
        // Student view: list the choices, never the answer key.
        const opts = q.options?.length
          ? `<ol class="opts">${q.options
              .map(o => `<li>(${escapeHtml(o.key)}) ${escapeHtml(o.text)}</li>`)
              .join('')}</ol>`
          : '';
        return `
        <tr>
          <td class="num">${i + 1}.</td>
          <td class="q">${escapeHtml(q.questionText)}
            <span class="meta">[${q.coCode} · ${this.bloomLabels[q.bloomLevel]}]</span>
            ${opts}
          </td>
          <td class="marks">${q.marks}</td>
        </tr>`;
      })
      .join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(paper.title)}</title>
      <style>
        *{box-sizing:border-box} body{font-family:Georgia,'Times New Roman',serif;color:#111726;margin:48px;line-height:1.5}
        .head{text-align:center;border-bottom:2px solid #111726;padding-bottom:12px;margin-bottom:8px}
        .head h1{font-size:18px;margin:0 0 4px} .head p{margin:2px 0;font-size:13px;color:#344054}
        .bar{display:flex;justify-content:space-between;font-size:13px;margin:12px 0;font-weight:bold}
        .rules{font-size:12px;color:#344054;margin-bottom:16px;font-style:italic}
        table{width:100%;border-collapse:collapse} td{vertical-align:top;padding:9px 6px;border-bottom:1px solid #E6E8EE}
        td.num{width:28px;font-weight:bold} td.marks{width:60px;text-align:right;font-weight:bold;white-space:nowrap}
        .meta{color:#667085;font-size:11px;font-style:italic;font-family:monospace;margin-left:6px}
        .opts{list-style:none;margin:8px 0 0;padding:0;columns:2;column-gap:28px;font-size:13px}
        .opts li{margin:0 0 3px;break-inside:avoid}
        .foot{margin-top:24px;text-align:center;font-size:11px;color:#98A2B3}
      </style></head><body>
      <div class="head">
        <h1>${escapeHtml(course?.courseCode ?? paper.courseCode)} — ${escapeHtml(course?.courseName ?? '')}</h1>
        <p>${escapeHtml(paper.title)}</p>
        ${this.examName() ? `<p>${escapeHtml(this.examName())}</p>` : ''}
      </div>
      <div class="bar"><span>Max marks: ${paper.totalMarks}</span>${this.durationMinutes() ? `<span>Time: ${this.durationMinutes()} min</span>` : ''}</div>
      ${this.paperInstructions() ? `<p class="rules">${escapeHtml(this.paperInstructions())}</p>` : ''}
      <table><tbody>${rows}</tbody></table>
      <p class="foot">Generated with the OBE Engine · ${paper.totalQuestions} questions</p>
      </body></html>`;
  }

  /* ------------------------- step navigation -------------------------- */
  canNext(): boolean {
    switch (this.step()) {
      case 1: return !!this.selectedUnit()?.isEmbedded;
      case 2: return this.totalQuestions() > 0;
      case 3: return this.selectedCoIds().length > 0;
      case 5: return this.keptQuestions().length > 0;
      default: return true;
    }
  }

  next(): void {
    const s = this.step();
    if (!this.canNext()) return;
    if (s === 3) { this.generate(); return; }      // step 3 → generate → step 4/5
    if (s === 5) {
      if (!this.paperTitle()) this.paperTitle.set(`Unit Test — ${this.selectedCourse()?.courseName ?? ''}`.trim());
      this.step.set(6);
      return;
    }
    if (s < 6) this.step.set(s + 1);
  }
  back(): void {
    const s = this.step();
    if (s === 5) { this.step.set(3); return; }     // don't land on the transient generate screen
    if (s > 1) this.step.set(s - 1);
  }

  coStatement(coId: string): string {
    return this.outcomes().find(o => o.coId === coId)?.coCode ?? coId;
  }
}

/** Minimal HTML escaping for the printable paper. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
