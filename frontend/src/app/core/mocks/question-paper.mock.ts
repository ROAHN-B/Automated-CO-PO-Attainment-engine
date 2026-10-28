/**
 * In-memory stand-in for the question paper endpoints (API_CONTRACT v2.7 §10, QPV-1 … QPV-8).
 *
 * The store applies the contract's rules the way the backend will: it lists the
 * paper's `issues`, computes `computedTotalMarks` (attempt rules applied) and
 * refuses validation while issues remain. The "AI" result is a deterministic
 * keyword check so the demo behaves the same every time; the real scores come
 * from Mayuri's pipeline. Confirming a paper hands its marksheet structure to
 * the workspace store; there is no moderator role.
 */
import { ExportFile } from '../models/common.model';
import { StepState } from '../models/faculty-workspace.model';
import { StructureQuestion } from '../models/marksheet.model';
import {
  ExamCategory, QP_BLOOM_LEVELS, QpAlignment, QpBloomLevel, QpCourseOutcome, QpIssue, QpPaper, QpPaperUpdate,
  QpQuestion, QpSheetFormat, QpSubQuestion, QpValidationResult, ValidatedSubQuestion, qpPaperMarks, qpSubQuestionsOf,
} from '../models/question-paper.model';
import { MockError } from './mock-error';
import { ModerationSheetContext, moderationSheetHtml } from './moderation-sheet.mock';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const now = () => new Date().toISOString();

/** How long the mock "analysis" takes before QPV-1 reports ANALYSIS_READY. */
export const QP_MOCK_ANALYSIS_MS = 2500;

/** The exam an assessment ID points at, as the workspace store knows it. */
export interface QpExam {
  offeringId: string;
  assessmentId: string;
  name: string;
  category: ExamCategory;
  /** From the assessment plan. */
  maxMarks: number;
  step: StepState;
}

/** What the workspace store provides: exams, CAM COs, sheet details and the lifecycle hooks. */
export interface QpHost {
  exam(assessmentId: string): QpExam;
  /** The COs of the course's finalized CAM; throws when the CAM isn't finalized. */
  courseOutcomes(offeringId: string): QpCourseOutcome[];
  /** Course, class and faculty details printed on the moderation sheet. */
  sheetContext(assessmentId: string): Omit<ModerationSheetContext, 'submittedOn'>;
  /** The first save moves the step to IN_PROGRESS. */
  onStarted(assessmentId: string): void;
  /** QPV-6: completes paper validation, opens the marksheet and stores its generated structure. */
  onFinalized(assessmentId: string, questions: StructureQuestion[]): void;
  /** Whether the cycle's marksheet is finalized (QPV-8 is refused then). */
  marksheetFinalized(assessmentId: string): boolean;
  /** QPV-8: removes the generated marksheet and locks the step again. */
  onReopened(assessmentId: string): void;
}

/** §10.7.6 mapping: each sub-question becomes a read-only marksheet item. */
export function structureFromPaper(questions: QpQuestion[]): StructureQuestion[] {
  return questions.map(q => ({
    questionNo: q.questionNo,
    ...(q.attemptRule ? { attemptRule: clone(q.attemptRule) } : {}),
    subQuestions: qpSubQuestionsOf(q).map(({ part, sub }) => ({
      label: part ? `(${part.label})(${sub.label})` : `(${sub.label})`,
      coIds: [(part?.coId ?? q.coId)!], maxMarks: sub.marks, bloomLevel: sub.expectedBloomLevel,
    })),
  }));
}

/* ------------------------------------------------------------------------ */
/*  Paper checks (§10.5) — what the backend returns in `issues`              */
/* ------------------------------------------------------------------------ */

export function paperIssues(
  paper: Pick<QpPaper, 'header' | 'coIds' | 'questions'>, courseOutcomes: QpCourseOutcome[],
): QpIssue[] {
  const issues: QpIssue[] = [];
  const add = (code: QpIssue['code'], message: string, path?: string) => issues.push({ code, message, path });
  const known = new Map(courseOutcomes.map(c => [c.coId, c.code]));
  const selected = new Set(paper.coIds);

  if (!paper.coIds.length) add('CO_NOT_SELECTED', 'Tick the COs this paper covers.', 'coIds');
  paper.coIds.forEach((id, i) => {
    if (!known.has(id)) add('CO_NOT_SELECTED', 'One of the ticked COs isn’t in the course’s CAM.', `coIds[${i}]`);
  });
  const coCheck = (coId: string | undefined, where: string, path: string) => {
    if (!coId) add('MISSING_CO', `Choose the CO for ${where}.`, path);
    else if (!selected.has(coId)) add('CO_NOT_SELECTED', `${where} uses ${known.get(coId) ?? 'a CO'}, which isn’t ticked for this paper.`, path);
  };
  const duplicates = (labels: string[]) => labels.map(l => l.trim().toLowerCase()).filter((l, i, all) => l && all.indexOf(l) !== i);

  if (!(paper.header.maxMarks > 0)) add('INVALID_MARKS', 'Enter the paper’s maximum marks.', 'header.maxMarks');
  if (!paper.questions.length) add('NO_QUESTIONS', 'Add at least one question.', 'questions');

  duplicates(paper.questions.map(q => q.questionNo)).forEach(l =>
    add('DUPLICATE_LABEL', `Two questions are numbered ${l.toUpperCase()}.`, 'questions'));

  paper.questions.forEach((q, qi) => {
    const qp = `questions[${qi}]`;
    const qName = q.questionNo.trim() || `Question ${qi + 1}`;
    if (!q.questionNo.trim()) add('MISSING_TEXT', `Question ${qi + 1} needs a number.`, `${qp}.questionNo`);

    const subs = (list: QpSubQuestion[], where: string, path: string) => {
      if (!list.length) add('NO_QUESTIONS', `${where} has no sub-questions.`, path);
      duplicates(list.map(s => s.label)).forEach(l => add('DUPLICATE_LABEL', `${where} has two sub-questions labelled (${l}).`, path));
      list.forEach((s, si) => {
        const sp = `${path}[${si}]`;
        const sName = `${where} (${s.label.trim() || si + 1})`;
        if (!s.label.trim()) add('MISSING_TEXT', `Sub-question ${si + 1} of ${where} needs a label.`, `${sp}.label`);
        if (!s.text.trim()) add('MISSING_TEXT', `${sName} has no question text.`, `${sp}.text`);
        if (!(Number(s.marks) > 0)) add('INVALID_MARKS', `${sName} needs marks greater than 0.`, `${sp}.marks`);
        if (s.type === 'MCQ') {
          const opts = s.options ?? [];
          const keys = opts.map(o => o.key.trim().toUpperCase());
          if (opts.length < 2 || opts.length > 6) add('MCQ_OPTIONS', `${sName} needs 2 to 6 options.`, `${sp}.options`);
          else if (opts.some(o => !o.text.trim())) add('MCQ_OPTIONS', `${sName} has an empty option.`, `${sp}.options`);
          else if (new Set(keys).size !== keys.length) add('MCQ_OPTIONS', `${sName} repeats an option letter.`, `${sp}.options`);
        }
      });
    };

    if (q.parts?.length && q.subQuestions?.length) {
      add('MISSING_TEXT', `${qName} has both parts and direct sub-questions; keep one.`, qp);
    }
    if (q.parts?.length) {
      duplicates(q.parts.map(p => p.label)).forEach(l => add('DUPLICATE_LABEL', `${qName} has two parts labelled (${l}).`, `${qp}.parts`));
      q.parts.forEach((p, pi) => {
        const where = `${qName} (${p.label.trim() || pi + 1})`;
        if (!p.label.trim()) add('MISSING_TEXT', `Part ${pi + 1} of ${qName} needs a label.`, `${qp}.parts[${pi}].label`);
        coCheck(p.coId, where, `${qp}.parts[${pi}].coId`);
        subs(p.subQuestions, where, `${qp}.parts[${pi}].subQuestions`);
      });
    } else {
      coCheck(q.coId, qName, `${qp}.coId`);
      subs(q.subQuestions ?? [], qName, `${qp}.subQuestions`);
    }

    if (q.attemptRule) {
      const count = qpSubQuestionsOf(q).length;
      const { attempt, outOf } = q.attemptRule;
      if (!(attempt >= 1) || attempt > outOf || outOf !== count) {
        add('ATTEMPT_RULE', `${qName}: “attempt ${attempt} of ${outOf}” must match its ${count} sub-questions.`, `${qp}.attemptRule`);
      }
    }
  });

  const total = qpPaperMarks(paper.questions);
  if (paper.header.maxMarks > 0 && paper.questions.length && total !== paper.header.maxMarks) {
    add('TOTAL_MISMATCH', `The questions add up to ${total} marks, but the paper is out of ${paper.header.maxMarks}.`, 'header.maxMarks');
  }
  return issues;
}

/* ------------------------------------------------------------------------ */
/*  Mock analysis — a stand-in for the AI, deterministic for the demo        */
/* ------------------------------------------------------------------------ */

const BLOOM_VERBS: Record<QpBloomLevel, string[]> = {
  REMEMBER: ['define', 'list', 'state', 'name', 'what is', 'which', 'identify', 'recall', 'expand'],
  UNDERSTAND: ['explain', 'describe', 'discuss', 'illustrate', 'summarize', 'classify', 'outline', 'why'],
  APPLY: ['apply', 'compute', 'calculate', 'configure', 'implement', 'demonstrate', 'solve', 'use', 'encrypt', 'decrypt'],
  ANALYZE: ['analyze', 'analyse', 'compare', 'differentiate', 'distinguish', 'examine', 'contrast'],
  EVALUATE: ['evaluate', 'justify', 'assess', 'critique', 'recommend', 'defend'],
  CREATE: ['design', 'create', 'propose', 'develop', 'construct', 'formulate', 'plan'],
};

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'across', 'their', 'basic', 'techniques',
  'functioning', 'working', 'design', 'apply', 'analyze', 'explain', 'illustrate', 'recommend', 'solutions', 'fundamental']);
const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
  .filter(w => w.length > 3 && !STOP.has(w)).map(w => w.replace(/s$/, '')));

function detectBloom(text: string, expected: QpBloomLevel): QpBloomLevel {
  const t = ` ${text.toLowerCase()} `;
  let first: { level: QpBloomLevel; at: number } | null = null;
  for (const level of QP_BLOOM_LEVELS) {
    for (const verb of BLOOM_VERBS[level]) {
      const at = t.search(new RegExp(`\\b${verb}\\b`));
      if (at >= 0 && (!first || at < first.at)) first = { level, at };
    }
  }
  return first?.level ?? expected;
}

const bloomGap = (a: QpBloomLevel, b: QpBloomLevel) => Math.abs(QP_BLOOM_LEVELS.indexOf(a) - QP_BLOOM_LEVELS.indexOf(b));
const alignment = (gap: number): QpAlignment => (gap === 0 ? 'ALIGNED' : gap === 1 ? 'PARTIAL' : 'MISALIGNED');

export function mockAnalysis(paper: QpPaper): QpValidationResult {
  const cos = paper.courseOutcomes.filter(c => paper.coIds.includes(c.coId));
  const coTokens = new Map(cos.map(c => [c.coId, tokens(c.statement)]));
  const code = (id: string) => paper.courseOutcomes.find(c => c.coId === id)?.code ?? id;

  const subQuestions: ValidatedSubQuestion[] = paper.questions.flatMap(q => qpSubQuestionsOf(q).map(({ part, sub }) => {
    const coId = (part?.coId ?? q.coId)!;
    const words = tokens(`${q.heading ?? ''} ${sub.text} ${(sub.options ?? []).map(o => o.text).join(' ')}`);
    const overlap = (id: string) => [...(coTokens.get(id) ?? [])].filter(w => words.has(w)).length;
    const mine = overlap(coId);
    const best = cos.map(c => ({ id: c.coId, n: overlap(c.coId) })).sort((a, b) => b.n - a.n)[0];
    const better = best && best.id !== coId && best.n >= mine + 2;
    const coAlignment: QpAlignment = !better ? 'ALIGNED' : mine === 0 ? 'MISALIGNED' : 'PARTIAL';

    const detected = detectBloom(sub.text, sub.expectedBloomLevel);
    const bloomAlignment = alignment(bloomGap(detected, sub.expectedBloomLevel));

    let mcqCheck: ValidatedSubQuestion['mcqCheck'];
    if (sub.type === 'MCQ') {
      const texts = (sub.options ?? []).map(o => o.text.trim().toLowerCase());
      mcqCheck = new Set(texts).size !== texts.length
        ? { status: 'ISSUE', note: 'Two options have the same text, so more than one answer can be right.' }
        : { status: 'OK' };
    }
    const flags = sub.text.trim().length < 25 ? ['AMBIGUOUS_WORDING'] : undefined;

    const notes: string[] = [];
    notes.push(coAlignment === 'ALIGNED'
      ? `Fits ${code(coId)}.`
      : `Reads closer to ${code(best!.id)} than to ${code(coId)}.`);
    notes.push(bloomAlignment === 'ALIGNED'
      ? `The wording asks students to ${detected.toLowerCase()}, as expected.`
      : `The wording asks students to ${detected.toLowerCase()}; you expected ${sub.expectedBloomLevel.toLowerCase()}.`);
    if (mcqCheck?.status === 'ISSUE') notes.push(mcqCheck.note!);
    if (flags) notes.push('The question is very short; add enough context to make it unambiguous.');

    const score = 100
      - (coAlignment === 'PARTIAL' ? 20 : coAlignment === 'MISALIGNED' ? 40 : 0)
      - (bloomAlignment === 'PARTIAL' ? 15 : bloomAlignment === 'MISALIGNED' ? 35 : 0)
      - (mcqCheck?.status === 'ISSUE' ? 15 : 0)
      - (flags ? 10 : 0);

    return {
      questionNo: q.questionNo, partLabel: part?.label, label: sub.label, coId,
      coAlignment, suggestedCoId: better ? best!.id : undefined,
      expectedBloomLevel: sub.expectedBloomLevel, detectedBloomLevel: detected, bloomAlignment,
      mcqCheck, aiAnalysis: notes.join(' '), validationScore: Math.max(0, score), flags,
    };
  }));

  const marksOf = (v: ValidatedSubQuestion) => {
    const q = paper.questions.find(x => x.questionNo === v.questionNo)!;
    return qpSubQuestionsOf(q).find(x => x.part?.label === v.partLabel && x.sub.label === v.label)!.sub.marks;
  };
  const totalMarks = subQuestions.reduce((a, v) => a + marksOf(v), 0) || 1;
  const overall = Math.round(subQuestions.reduce((a, v) => a + v.validationScore * marksOf(v), 0) / totalMarks);
  const aligned = subQuestions.filter(v => v.coAlignment === 'ALIGNED' && v.bloomAlignment === 'ALIGNED').length;

  return {
    validationId: paper.validationId,
    basedOnVersion: paper.version,
    overallValidationScore: overall,
    summary: `${aligned} of ${subQuestions.length} sub-questions match both their CO and the expected Bloom level.`
      + (aligned < subQuestions.length ? ' Review the flagged ones before confirming the paper.' : ''),
    subQuestions,
    coCoverage: cos.map(c => {
      const list = subQuestions.filter(v => v.coId === c.coId);
      return { coId: c.coId, code: c.code, subQuestionCount: list.length, marks: list.reduce((a, v) => a + marksOf(v), 0) };
    }),
    bloomDistribution: QP_BLOOM_LEVELS.map(level => {
      const list = subQuestions.filter(v => v.expectedBloomLevel === level);
      return { level, subQuestionCount: list.length, marks: list.reduce((a, v) => a + marksOf(v), 0) };
    }),
    modelUsed: 'gemini-2.5-pro', templateId: 'qp-validation', templateVersion: '1', generatedAt: now(),
  };
}

/* ------------------------------------------------------------------------ */
/*  Store                                                                    */
/* ------------------------------------------------------------------------ */

type StoredPaper = Omit<QpPaper, 'courseOutcomes' | 'computedTotalMarks' | 'issues' | 'assessmentName' | 'examCategory'>;

export class QuestionPaperMockStore {
  private readonly papers: Record<string, StoredPaper> = {};
  private readonly results: Record<string, QpValidationResult> = {};
  private readonly readyAt: Record<string, number> = {};
  /** Lets tests exercise ANALYSIS_FAILED. */
  failNextAnalysis = false;

  constructor(private readonly host: QpHost, seeds: (Pick<QpPaper, 'assessmentId'> & Partial<QpPaper>)[] = []) {
    for (const s of seeds) {
      const exam = host.exam(s.assessmentId);
      this.papers[s.assessmentId] = { ...this.blank(exam), ...clone(s), status: s.status ?? 'DRAFT' } as StoredPaper;
    }
  }

  /** QPV-1 — an empty DRAFT the first time; finishes a due analysis. */
  paper(assessmentId: string): QpPaper {
    const exam = this.exam(assessmentId);
    const p = this.papers[assessmentId] ??= this.blank(exam);
    if (p.status === 'ANALYZING' && Date.now() >= this.readyAt[assessmentId]) {
      if (this.failNextAnalysis) {
        this.failNextAnalysis = false;
        p.status = 'ANALYSIS_FAILED';
        p.error = { errorCode: 'AI_UNAVAILABLE', message: 'The AI service didn’t respond. Try again.' };
      } else {
        this.results[assessmentId] = mockAnalysis(this.view(exam, p));
        p.status = 'ANALYSIS_READY';
      }
    }
    return this.view(exam, p);
  }

  /** QPV-2 — saves even with issues; editing an analysed paper returns it to DRAFT. */
  save(assessmentId: string, update: QpPaperUpdate): QpPaper {
    const exam = this.exam(assessmentId);
    const p = this.writable(exam, update.version);
    if (p.status === 'ANALYZING') throw new MockError(409, 'INVALID_STATE', 'Wait for the analysis to finish before editing.');
    const first = p.version === 0 && exam.step.status === 'AVAILABLE';
    // Maximum marks always come from the assessment plan (§10.5).
    p.header = { ...clone(update.header), maxMarks: exam.maxMarks };
    p.coIds = [...update.coIds];
    p.questions = clone(update.questions);
    if (p.status !== 'DRAFT') {
      p.status = 'DRAFT';
      delete p.error;
      delete this.results[assessmentId];
    }
    this.touch(p);
    if (first) this.host.onStarted(assessmentId);
    return this.view(exam, p);
  }

  /** QPV-3 — 202 ANALYZING; refused while issues remain. */
  validate(assessmentId: string, version: number): QpPaper {
    const exam = this.exam(assessmentId);
    const p = this.writable(exam, version);
    if (p.status === 'ANALYZING') throw new MockError(409, 'INVALID_STATE', 'The paper is already being analysed.');
    if (p.status === 'ANALYSIS_READY') throw new MockError(409, 'INVALID_STATE', 'This version is already analysed.');
    const issues = this.view(exam, p).issues;
    if (issues.length) {
      throw new MockError(422, 'PRECONDITION_FAILED', `Fix the ${issues.length === 1 ? 'problem' : `${issues.length} problems`} in the paper first.`);
    }
    p.status = 'ANALYZING';
    delete p.error;
    this.readyAt[assessmentId] = Date.now() + QP_MOCK_ANALYSIS_MS;
    return this.view(exam, this.touch(p));
  }

  /** QPV-4 */
  result(assessmentId: string): QpValidationResult {
    this.paper(assessmentId);
    const r = this.results[assessmentId];
    if (!r) throw new MockError(404, 'NOT_FOUND', 'This paper hasn’t been analysed yet.');
    return clone(r);
  }

  /**
   * QPV-5 — the college's moderation sheet. The demo returns the sheet as
   * Word-readable HTML (DOCX) or a printable page (PDF); the backend renders
   * the real .docx and .pdf (§10.7.7).
   */
  moderationSheet(assessmentId: string, format: QpSheetFormat): ExportFile {
    const paper = this.paper(assessmentId);
    if (paper.examCategory !== 'ISE') throw new MockError(404, 'NOT_FOUND', 'ESE papers have no moderation sheet.');
    if (paper.status !== 'ANALYSIS_READY' && paper.status !== 'FINALIZED') {
      throw new MockError(409, 'INVALID_STATE', 'Validate the paper before downloading the moderation sheet.');
    }
    const ctx = { ...this.host.sheetContext(assessmentId), submittedOn: paper.finalizedAt };
    const word = format === 'DOCX';
    const html = moderationSheetHtml(ctx, paper, !word);
    const blob = new Blob([html], { type: word ? 'application/msword' : 'text/html' });
    const base = `${ctx.courseCode}_${paper.assessmentName}_Set${paper.header.setLabel ?? ''}_moderation_sheet`;
    return {
      fileId: `file-ms-${assessmentId}-${format}`, fileName: `${base}${word ? '.doc' : '.html'}`,
      mimeType: blob.type, sizeBytes: blob.size, downloadUrl: URL.createObjectURL(blob),
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
  }

  /** QPV-6 — Confirm paper: locks it, opens the marksheet and generates its structure. */
  finalize(assessmentId: string, version: number): QpPaper {
    const exam = this.exam(assessmentId);
    const p = this.writable(exam, version);
    if (p.status !== 'ANALYSIS_READY') {
      throw new MockError(409, 'INVALID_STATE', 'Validate the paper with the AI before confirming it.');
    }
    p.status = 'FINALIZED';
    p.finalizedAt = now();
    this.touch(p);
    this.host.onFinalized(assessmentId, structureFromPaper(p.questions));
    return this.view(exam, p);
  }

  /** QPV-8 — Reopen: allowed until the marksheet is finalized. */
  reopen(assessmentId: string, version: number): QpPaper {
    this.exam(assessmentId);
    const p = this.papers[assessmentId];
    if (!p || p.status !== 'FINALIZED') throw new MockError(409, 'INVALID_STATE', 'Only a confirmed paper can be reopened.');
    if (version !== p.version) throw new MockError(409, 'VERSION_CONFLICT', 'Someone else saved this paper. Reload to see their changes.');
    if (this.host.marksheetFinalized(assessmentId)) {
      throw new MockError(409, 'INVALID_STATE', 'The marksheet is finalized, so the paper can’t be reopened.');
    }
    p.status = 'ANALYSIS_READY';
    delete p.finalizedAt;
    this.touch(p);
    this.host.onReopened(assessmentId);
    return this.view(this.host.exam(assessmentId), p);
  }

  /* ------------------------------- helpers ------------------------------ */

  private exam(assessmentId: string): QpExam {
    const exam = this.host.exam(assessmentId);
    if (exam.step.status === 'LOCKED') throw new MockError(409, 'STAGE_LOCKED', exam.step.lockedReason ?? 'This step is locked.');
    return exam;
  }

  private writable(exam: QpExam, version: number): StoredPaper {
    const p = this.papers[exam.assessmentId] ??= this.blank(exam);
    if (p.status === 'FINALIZED') throw new MockError(409, 'ALREADY_FINALIZED', 'The paper is confirmed. Reopen it to make changes.');
    if (version !== p.version) throw new MockError(409, 'VERSION_CONFLICT', 'Someone else saved this paper. Reload to see their changes.');
    return p;
  }

  private blank(exam: QpExam): StoredPaper {
    return {
      validationId: `qpv-${exam.assessmentId}`, offeringId: exam.offeringId, assessmentId: exam.assessmentId,
      // Demo cycles that start completed have no typed paper; show them as already confirmed.
      status: exam.step.status === 'DONE' ? 'FINALIZED' : 'DRAFT',
      version: 0, header: { maxMarks: exam.maxMarks }, coIds: [], questions: [],
      updatedAt: now(), updatedBy: 'Rohan Belsare',
    };
  }

  private view(exam: QpExam, p: StoredPaper): QpPaper {
    const courseOutcomes = this.host.courseOutcomes(exam.offeringId);
    const questions: QpQuestion[] = clone(p.questions);
    return {
      ...clone(p), assessmentName: exam.name, examCategory: exam.category, courseOutcomes, questions,
      computedTotalMarks: qpPaperMarks(questions),
      issues: paperIssues(p, courseOutcomes),
    };
  }

  private touch(p: StoredPaper): StoredPaper {
    p.version += 1;
    p.updatedAt = now();
    p.updatedBy = 'Rohan Belsare';
    return p;
  }
}
