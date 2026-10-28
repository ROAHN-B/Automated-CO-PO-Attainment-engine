import { computed, signal } from '@angular/core';
import {
  QpBloomLevel, QpOption, QpPaper, QpPaperHeader, QpPaperUpdate, QpPart, QpQuestion, QpSubQuestion,
  qpPaperMarks, qpQuestionMarks, qpSubQuestionsOf,
} from '../../../../core/models/question-paper.model';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];
const LETTERS = 'abcdefghij';
const OPTION_KEYS = 'ABCDEF';

/** Where a sub-question sits: directly under its question, or in part `pi`. */
export type SubPath = { qi: number; pi: number | null; si: number };

const blankSub = (label: string, bloom: QpBloomLevel = 'UNDERSTAND'): QpSubQuestion =>
  ({ label, text: '', type: 'DESCRIPTIVE', marks: 1, expectedBloomLevel: bloom });
const blankOptions = (): QpOption[] => [...OPTION_KEYS.slice(0, 4)].map(key => ({ key, text: '' }));

/**
 * The faculty's unsaved edits to a typed question paper (API_CONTRACT §10.1).
 * It only shapes what the faculty types: labels are suggested, an attempt rule
 * follows the number of sub-questions, and totals are a preview. The backend's
 * `issues` and `computedTotalMarks` decide whether the paper can be validated.
 */
export class PaperDraft {
  readonly header = signal<QpPaperHeader>({ maxMarks: 0 });
  readonly coIds = signal<string[]>([]);
  readonly questions = signal<QpQuestion[]>([]);

  readonly totalPreview = computed(() => qpPaperMarks(this.questions()));
  readonly subQuestionCount = computed(() => this.questions().reduce((a, q) => a + qpSubQuestionsOf(q).length, 0));

  private readonly baseline = signal('');
  readonly dirty = computed(() => this.baseline() !== '' && JSON.stringify(this.toUpdate(0)) !== this.baseline());

  reset(paper: QpPaper): void {
    this.header.set(clone(paper.header));
    this.coIds.set([...paper.coIds]);
    this.questions.set(clone(paper.questions));
    this.baseline.set(JSON.stringify(this.toUpdate(0)));
  }

  /** The draft as a QPV-2 body: empty optional fields dropped, MCQ options only on MCQs. */
  toUpdate(version: number): QpPaperUpdate {
    const sub = (s: QpSubQuestion): QpSubQuestion => ({
      label: s.label.trim(), text: s.text, type: s.type, marks: Number(s.marks),
      expectedBloomLevel: s.expectedBloomLevel,
      ...(s.type === 'MCQ' ? { options: (s.options ?? []).map(o => ({ key: o.key, text: o.text })) } : {}),
    });
    const h = this.header();
    return {
      version,
      header: {
        maxMarks: Number(h.maxMarks),
        ...(h.setLabel?.trim() ? { setLabel: h.setLabel.trim() } : {}),
        ...(h.durationMinutes ? { durationMinutes: Number(h.durationMinutes) } : {}),
        ...(h.examDate ? { examDate: h.examDate } : {}),
      },
      coIds: [...this.coIds()],
      questions: this.questions().map(q => ({
        questionNo: q.questionNo.trim(),
        ...(q.heading?.trim() ? { heading: q.heading.trim() } : {}),
        ...(q.attemptRule ? { attemptRule: { ...q.attemptRule } } : {}),
        ...(q.parts?.length
          ? { parts: q.parts.map(p => ({ label: p.label.trim(), coId: p.coId, subQuestions: p.subQuestions.map(sub) })) }
          : { ...(q.coId ? { coId: q.coId } : {}), subQuestions: (q.subQuestions ?? []).map(sub) }),
      })),
    };
  }

  /* --------------------------------- header --------------------------------- */

  patchHeader(patch: Partial<QpPaperHeader>): void {
    this.header.update(h => ({ ...h, ...patch }));
  }

  toggleCo(coId: string): void {
    this.coIds.update(ids => (ids.includes(coId) ? ids.filter(i => i !== coId) : [...ids, coId]));
  }

  /* -------------------------------- questions ------------------------------- */

  questionMarks(q: QpQuestion): number {
    return qpQuestionMarks(q);
  }

  addQuestion(): void {
    const used = new Set(this.questions().map(q => q.questionNo.trim().toUpperCase()));
    let n = this.questions().length + 1;
    while (used.has(`Q${n}`)) n++;
    const coId = this.coIds().length === 1 ? this.coIds()[0] : undefined;
    this.questions.update(qs => [...qs, { questionNo: `Q${n}`, coId, subQuestions: [blankSub('i')] }]);
  }

  removeQuestion(qi: number): void {
    this.questions.update(qs => qs.filter((_, i) => i !== qi));
  }

  patchQuestion(qi: number, patch: Partial<Pick<QpQuestion, 'questionNo' | 'heading' | 'coId'>>): void {
    this.mutate(qi, q => ({ ...q, ...patch }));
  }

  /**
   * Switch between direct sub-questions and parts. Going to parts moves the
   * existing sub-questions into part (a) with the question's CO; going back
   * merges every part's sub-questions under the question.
   */
  setUseParts(qi: number, useParts: boolean): void {
    this.mutate(qi, q => {
      if (useParts && !q.parts?.length) {
        const { coId, subQuestions, ...rest } = q;
        return { ...rest, parts: [{ label: 'a', coId: coId ?? '', subQuestions: subQuestions?.length ? subQuestions : [blankSub('i')] }] };
      }
      if (!useParts && q.parts?.length) {
        const { parts, ...rest } = q;
        return { ...rest, coId: parts[0]?.coId || undefined, subQuestions: parts.flatMap(p => p.subQuestions) };
      }
      return q;
    });
  }

  /** "Attempt any N": the rule always counts all of the question's sub-questions. */
  setAttempt(qi: number, attempt: number | null): void {
    this.mutate(qi, q => {
      if (attempt === null) {
        const { attemptRule, ...rest } = q;
        return rest;
      }
      return { ...q, attemptRule: { attempt, outOf: qpSubQuestionsOf(q).length } };
    });
  }

  /* ---------------------------------- parts --------------------------------- */

  addPart(qi: number): void {
    this.mutate(qi, q => {
      const parts = q.parts ?? [];
      const label = LETTERS[parts.length] ?? String(parts.length + 1);
      const prev = parts[parts.length - 1];
      return { ...q, parts: [...parts, { label, coId: '', subQuestions: [blankSub(this.nextLabel(q), prev?.subQuestions.at(-1)?.expectedBloomLevel)] }] };
    });
  }

  removePart(qi: number, pi: number): void {
    this.mutate(qi, q => ({ ...q, parts: (q.parts ?? []).filter((_, i) => i !== pi) }));
  }

  patchPart(qi: number, pi: number, patch: Partial<Pick<QpPart, 'label' | 'coId'>>): void {
    this.mutate(qi, q => ({ ...q, parts: (q.parts ?? []).map((p, i) => (i === pi ? { ...p, ...patch } : p)) }));
  }

  /* ------------------------------ sub-questions ----------------------------- */

  /** Labels run on across parts, as in the sample paper: (a) i–iii, (b) iv–vi. */
  nextLabel(q: QpQuestion): string {
    const used = new Set(qpSubQuestionsOf(q).map(x => x.sub.label.trim().toLowerCase()));
    return ROMAN.find(r => !used.has(r)) ?? String(used.size + 1);
  }

  addSub(qi: number, pi: number | null): void {
    this.mutate(qi, q => {
      const list = pi === null ? q.subQuestions ?? [] : q.parts![pi].subQuestions;
      const prev = list[list.length - 1];
      const fresh: QpSubQuestion = {
        ...blankSub(this.nextLabel(q), prev?.expectedBloomLevel),
        type: prev?.type ?? 'DESCRIPTIVE', marks: prev?.marks ?? 1,
        ...(prev?.type === 'MCQ' ? { options: blankOptions() } : {}),
      };
      return this.withSubs(q, pi, [...list, fresh]);
    });
  }

  removeSub(path: SubPath): void {
    this.mutate(path.qi, q => this.withSubs(q, path.pi, this.subs(q, path.pi).filter((_, i) => i !== path.si)));
  }

  patchSub(path: SubPath, patch: Partial<Pick<QpSubQuestion, 'label' | 'text' | 'marks' | 'expectedBloomLevel'>>): void {
    this.mapSub(path, s => ({ ...s, ...patch }));
  }

  setType(path: SubPath, type: QpSubQuestion['type']): void {
    this.mapSub(path, s => {
      if (type === s.type) return s;
      if (type === 'MCQ') return { ...s, type, options: s.options?.length ? s.options : blankOptions() };
      const { options, ...rest } = s;
      return { ...rest, type };
    });
  }

  setOption(path: SubPath, oi: number, text: string): void {
    this.mapSub(path, s => ({ ...s, options: (s.options ?? []).map((o, i) => (i === oi ? { ...o, text } : o)) }));
  }

  addOption(path: SubPath): void {
    this.mapSub(path, s => {
      const options = s.options ?? [];
      return options.length >= OPTION_KEYS.length ? s : { ...s, options: [...options, { key: OPTION_KEYS[options.length], text: '' }] };
    });
  }

  /** Removing an option re-letters the rest so keys stay A, B, C… */
  removeOption(path: SubPath, oi: number): void {
    this.mapSub(path, s => ({
      ...s, options: (s.options ?? []).filter((_, i) => i !== oi).map((o, i) => ({ ...o, key: OPTION_KEYS[i] })),
    }));
  }

  /* --------------------------------- helpers -------------------------------- */

  private subs(q: QpQuestion, pi: number | null): QpSubQuestion[] {
    return pi === null ? q.subQuestions ?? [] : q.parts?.[pi]?.subQuestions ?? [];
  }

  private withSubs(q: QpQuestion, pi: number | null, subQuestions: QpSubQuestion[]): QpQuestion {
    return pi === null
      ? { ...q, subQuestions }
      : { ...q, parts: (q.parts ?? []).map((p, i) => (i === pi ? { ...p, subQuestions } : p)) };
  }

  private mapSub(path: SubPath, fn: (s: QpSubQuestion) => QpSubQuestion): void {
    this.mutate(path.qi, q => this.withSubs(q, path.pi, this.subs(q, path.pi).map((s, i) => (i === path.si ? fn(s) : s))));
  }

  /** Apply a change to one question, keeping an attempt rule's "out of" equal to its sub-question count. */
  private mutate(qi: number, fn: (q: QpQuestion) => QpQuestion): void {
    this.questions.update(qs => qs.map((q, i) => {
      if (i !== qi) return q;
      const next = fn(clone(q));
      if (next.attemptRule) {
        const count = qpSubQuestionsOf(next).length;
        next.attemptRule = { attempt: Math.min(next.attemptRule.attempt, Math.max(count, 1)), outOf: count };
      }
      return next;
    }));
  }
}
