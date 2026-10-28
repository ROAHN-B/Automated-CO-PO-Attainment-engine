/**
 * In-memory stand-in for the marksheet structure endpoints (API_CONTRACT v2.7 §12, MS-1, MS-3, MS-4).
 *
 * For ISE and ESE theory papers the structure is generated when the faculty
 * confirms the question paper (§10.7.6) and is read-only. Finalizing it (MS-3)
 * completes the step; the workspace store then shows its columns in the
 * course workbook and opens marks entry.
 */
import { ExportFile } from '../models/common.model';
import { StepState } from '../models/faculty-workspace.model';
import { AssessmentStructure, StructureQuestion } from '../models/marksheet.model';
import { QpCourseOutcome } from '../models/question-paper.model';
import { MockError } from './mock-error';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** The assessment behind a marksheet, as the workspace store knows it. */
export interface MsAssessment {
  offeringId: string;
  name: string;
  plannedMaxMarks: number;
  step: StepState;
  /** Exams get their marksheet from the confirmed question paper. */
  fromPaper: boolean;
}

export interface MsHost {
  assessment(assessmentId: string): MsAssessment;
  courseOutcomes(offeringId: string): QpCourseOutcome[];
  /** Roll numbers for the template's student rows. */
  rollNumbers(offeringId: string): string[];
  /** MS-3: completes the step and opens marks entry. */
  onFinalized(assessmentId: string): void;
}

type Stored = Pick<AssessmentStructure, 'assessmentId' | 'status' | 'source' | 'version' | 'questions' | 'attemptRule'>;

/** Marks a question carries: its own, or its sub-questions' with the attempt rule applied. */
export function structureQuestionMarks(q: StructureQuestion): number {
  if (!q.subQuestions?.length) return q.maxMarks ?? 0;
  const marks = q.subQuestions.map(s => s.maxMarks).sort((a, b) => b - a);
  return (q.attemptRule ? marks.slice(0, q.attemptRule.attempt) : marks).reduce((a, b) => a + b, 0);
}

/** One workbook column per marksheet item: "Q1(a)(i)" or "Q1". */
export function structureColumns(questions: StructureQuestion[]): { label: string; maxMarks: number; coIds: string[] }[] {
  return questions.flatMap(q => q.subQuestions?.length
    ? q.subQuestions.map(s => ({ label: `${q.questionNo}${s.label}`, maxMarks: s.maxMarks, coIds: s.coIds }))
    : [{ label: q.questionNo, maxMarks: q.maxMarks ?? 0, coIds: q.coIds ?? [] }]);
}

export class MarksheetMockStore {
  private readonly structures: Record<string, Stored> = {};

  constructor(private readonly host: MsHost, seeds: Stored[] = []) {
    for (const s of seeds) this.structures[s.assessmentId] = clone(s);
  }

  /** MS-1 */
  structure(assessmentId: string): AssessmentStructure {
    const a = this.host.assessment(assessmentId);
    if (a.step.status === 'LOCKED') throw new MockError(409, 'STAGE_LOCKED', a.step.lockedReason ?? 'This step is locked.');
    const s = this.structures[assessmentId];
    if (!s) {
      if (a.fromPaper) throw new MockError(404, 'NOT_FOUND', 'Confirm the question paper to generate this marksheet.');
      throw new MockError(404, 'NOT_FOUND', 'The marksheet editor for activities, practicals and tutorials isn’t built yet.');
    }
    return this.view(assessmentId, a, s);
  }

  /** MS-3 — needs no issues; completes the step. */
  finalize(assessmentId: string, version: number): AssessmentStructure {
    const view = this.structure(assessmentId);
    const s = this.structures[assessmentId];
    if (s.status === 'FINALIZED') throw new MockError(409, 'ALREADY_FINALIZED', 'This marksheet is already finalized.');
    if (version !== s.version) throw new MockError(409, 'VERSION_CONFLICT', 'Someone else changed this marksheet. Reload to see it.');
    if (view.issues.length) throw new MockError(422, 'PRECONDITION_FAILED', view.issues[0].message);
    s.status = 'FINALIZED';
    s.version += 1;
    this.host.onFinalized(assessmentId);
    return this.view(assessmentId, this.host.assessment(assessmentId), s);
  }

  /** MS-4 — in the demo a CSV with the header rows and one row per student. */
  template(assessmentId: string): ExportFile {
    const s = this.structure(assessmentId);
    if (s.status !== 'FINALIZED') throw new MockError(409, 'INVALID_STATE', 'Finalize the marksheet before downloading its template.');
    const code = (id: string) => s.courseOutcomes.find(c => c.coId === id)?.code ?? id;
    const cols = structureColumns(s.questions);
    const lines = [
      ['Roll number', 'Name', ...cols.map(c => c.label)],
      ['', 'Max marks', ...cols.map(c => String(c.maxMarks))],
      ['', 'CO', ...cols.map(c => c.coIds.map(code).join(' '))],
      ...this.host.rollNumbers(s.offeringId).map(r => [r, '', ...cols.map(() => '')]),
    ];
    const blob = new Blob([lines.map(l => l.join(',')).join('\n')], { type: 'text/csv' });
    return {
      fileId: `file-mt-${assessmentId}`, fileName: `${s.assessmentName}_marksheet_template_demo.csv`, mimeType: 'text/csv',
      sizeBytes: blob.size, downloadUrl: URL.createObjectURL(blob), expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
  }

  /* ------------------------- called by the workspace ------------------------ */

  /** QPV-6 generated a read-only structure from the paper. */
  createFromPaper(assessmentId: string, questions: StructureQuestion[]): void {
    this.structures[assessmentId] = { assessmentId, status: 'DRAFT', source: 'QUESTION_PAPER', version: 1, questions: clone(questions) };
  }

  /** QPV-8 removed it again. */
  remove(assessmentId: string): void {
    delete this.structures[assessmentId];
  }

  isFinalized(assessmentId: string): boolean {
    return this.structures[assessmentId]?.status === 'FINALIZED';
  }

  /** The finalized questions, for the workbook's column block. */
  finalizedQuestions(assessmentId: string): StructureQuestion[] | null {
    const s = this.structures[assessmentId];
    return s?.status === 'FINALIZED' ? clone(s.questions) : null;
  }

  private view(assessmentId: string, a: MsAssessment, s: Stored): AssessmentStructure {
    const computed = s.questions.reduce((sum, q) => sum + structureQuestionMarks(q), 0);
    const issues: AssessmentStructure['issues'] = [];
    if (!s.questions.length) issues.push({ code: 'NO_QUESTIONS', message: 'The marksheet has no questions.' });
    else if (computed !== a.plannedMaxMarks) {
      issues.push({ code: 'TOTAL_MISMATCH', message: `The marksheet adds up to ${computed} marks, but the plan says ${a.plannedMaxMarks}.` });
    }
    return {
      ...clone(s), offeringId: a.offeringId, assessmentName: a.name, plannedMaxMarks: a.plannedMaxMarks,
      computedMaxMarks: computed, issues, courseOutcomes: this.host.courseOutcomes(a.offeringId),
    };
  }
}
