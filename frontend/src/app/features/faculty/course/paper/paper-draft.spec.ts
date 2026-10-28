import { FacultyWorkspaceMockStore } from '../../../../core/mocks/faculty-workspace.mock';
import { markingScheme, moderationRowLabels, moderationSheetHtml } from '../../../../core/mocks/moderation-sheet.mock';
import { QP_MOCK_ANALYSIS_MS } from '../../../../core/mocks/question-paper.mock';
import { qpQuestionMarks } from '../../../../core/models/question-paper.model';
import { PaperDraft } from './paper-draft';

const ISE3 = 'as-nsf-5';
const COURSE = 'off-ec7e1';

/** Run QPV-3 and let the mock analysis finish. */
function analyse(store: FacultyWorkspaceMockStore, version: number) {
  store.papers.validate(ISE3, version);
  jasmine.clock().tick(QP_MOCK_ANALYSIS_MS + 1);
  return store.papers.paper(ISE3);
}

describe('Question paper validation (API_CONTRACT v2.6 §10)', () => {
  beforeEach(() => jasmine.clock().install().mockDate(new Date('2026-10-28T09:00:00Z')));
  afterEach(() => jasmine.clock().uninstall());

  describe('mock backend rules', () => {
    it('serves the seeded ISE-3 draft with CAM COs, the attempt-rule total and no issues', () => {
      const p = new FacultyWorkspaceMockStore().papers.paper(ISE3);
      expect(p.status).toBe('DRAFT');
      expect(p.courseOutcomes.map(c => c.code)).toEqual(['CO1', 'CO2', 'CO3', 'CO4']);
      expect(p.computedTotalMarks).toBe(30); // Q1 6 × 1 + Q2 best 4 of 5 × 6
      expect(p.issues).toEqual([]);
    });

    it('counts the highest-scoring sub-questions under an attempt rule', () => {
      const marks = [6, 4, 8, 2].map((m, i) => ({ label: `${i}`, text: 'x', type: 'DESCRIPTIVE' as const, marks: m, expectedBloomLevel: 'APPLY' as const }));
      expect(qpQuestionMarks({ questionNo: 'Q1', coId: 'c', attemptRule: { attempt: 2, outOf: 4 }, subQuestions: marks })).toBe(14);
      expect(qpQuestionMarks({ questionNo: 'Q1', coId: 'c', subQuestions: marks })).toBe(20);
    });

    it('saves a broken draft and lists what blocks validation', () => {
      const store = new FacultyWorkspaceMockStore();
      const p = store.papers.paper(ISE3);
      const questions = structuredClone(p.questions);
      questions[0].parts![1].coId = 'co-ns-1';                 // not ticked
      questions[1].subQuestions![0].text = '  ';               // empty text
      questions[1].subQuestions![1].marks = 0;                 // invalid marks
      questions[0].parts![0].subQuestions[0].options = [{ key: 'A', text: 'Only one' }];
      const saved = store.papers.save(ISE3, { version: p.version, header: p.header, coIds: p.coIds, questions });
      const codes = saved.issues.map(i => i.code);
      expect(codes).toContain('CO_NOT_SELECTED');
      expect(codes).toContain('MISSING_TEXT');
      expect(codes).toContain('INVALID_MARKS');
      expect(codes).toContain('MCQ_OPTIONS');
      expect(() => store.papers.validate(ISE3, saved.version)).toThrowError(/Fix the/);
    });

    it('flags a total that differs from the planned maximum and a mismatched attempt rule', () => {
      const store = new FacultyWorkspaceMockStore();
      const p = store.papers.paper(ISE3);
      const questions = structuredClone(p.questions);
      questions[1].subQuestions!.pop();                         // 4 left, rule still says "of 5"
      questions[1].attemptRule = { attempt: 4, outOf: 5 };
      questions[1].subQuestions![0].marks = 5;
      const saved = store.papers.save(ISE3, { version: p.version, header: p.header, coIds: p.coIds, questions });
      expect(saved.computedTotalMarks).toBe(29);
      expect(saved.issues.map(i => i.code)).toEqual(jasmine.arrayContaining(['TOTAL_MISMATCH', 'ATTEMPT_RULE']));
    });

    it('takes the maximum marks from the plan, whatever the client sends', () => {
      const store = new FacultyWorkspaceMockStore();
      const p = store.papers.paper(ISE3);
      const saved = store.papers.save(ISE3, { version: p.version, header: { ...p.header, maxMarks: 50 }, coIds: p.coIds, questions: p.questions });
      expect(saved.header.maxMarks).toBe(30);
      expect(saved.issues).toEqual([]);
    });

    it('rejects a stale version', () => {
      const store = new FacultyWorkspaceMockStore();
      const p = store.papers.paper(ISE3);
      store.papers.save(ISE3, { version: p.version, header: p.header, coIds: p.coIds, questions: p.questions });
      expect(() => store.papers.save(ISE3, { version: p.version, header: p.header, coIds: p.coIds, questions: p.questions }))
        .toThrowError(/Someone else saved/);
    });

    it('analyses, flags the seeded problems, and returns to draft on an edit', () => {
      const store = new FacultyWorkspaceMockStore();
      const ready = analyse(store, store.papers.paper(ISE3).version);
      expect(ready.status).toBe('ANALYSIS_READY');
      const r = store.papers.result(ISE3);
      expect(r.subQuestions.length).toBe(11);
      expect(r.subQuestions.find(v => v.label === 'vi')!.mcqCheck!.status).toBe('ISSUE');
      const q2iv = r.subQuestions.find(v => v.questionNo === 'Q2' && v.label === 'iv')!;
      expect(q2iv.detectedBloomLevel).toBe('UNDERSTAND');
      expect(q2iv.bloomAlignment).toBe('PARTIAL');
      expect(r.coCoverage.map(c => [c.code, c.subQuestionCount])).toEqual([['CO3', 8], ['CO4', 3]]);

      const edited = store.papers.save(ISE3, { version: ready.version, header: ready.header, coIds: ready.coIds, questions: ready.questions });
      expect(edited.status).toBe('DRAFT');
      expect(() => store.papers.result(ISE3)).toThrowError(/hasn’t been analysed/);
    });

    it('reports a failed analysis and allows a retry', () => {
      const store = new FacultyWorkspaceMockStore();
      store.papers.failNextAnalysis = true;
      const failed = analyse(store, store.papers.paper(ISE3).version);
      expect(failed.status).toBe('ANALYSIS_FAILED');
      expect(failed.error?.errorCode).toBe('AI_UNAVAILABLE');
      expect(analyse(store, failed.version).status).toBe('ANALYSIS_READY');
    });

    it('confirming locks the paper, opens the marksheet and generates it read-only', () => {
      const store = new FacultyWorkspaceMockStore();
      expect(() => store.papers.finalize(ISE3, store.papers.paper(ISE3).version)).toThrowError(/Validate the paper/);
      const ready = analyse(store, store.papers.paper(ISE3).version);
      const confirmed = store.papers.finalize(ISE3, ready.version);
      expect(confirmed.status).toBe('FINALIZED');
      expect(confirmed.finalizedAt).toBeDefined();
      expect(() => store.papers.save(ISE3, { version: confirmed.version, header: confirmed.header, coIds: confirmed.coIds, questions: confirmed.questions }))
        .toThrowError(/Reopen it/);

      const cycle = store.offering(COURSE).progress.cycles[4];
      expect(cycle.steps.paperValidation!.status).toBe('DONE');
      expect(cycle.steps.marksheet.status).toBe('AVAILABLE');
      expect(store.offering(COURSE).progress.nextAction?.step).toBe('MARKSHEET');

      const s = store.marksheets.structure(ISE3);
      expect(s.source).toBe('QUESTION_PAPER');
      expect(s.status).toBe('DRAFT');
      expect(s.computedMaxMarks).toBe(30);
      expect(s.issues).toEqual([]);
      expect(s.questions[0].subQuestions!.map(x => x.label)).toEqual(['(a)(i)', '(a)(ii)', '(a)(iii)', '(b)(iv)', '(b)(v)', '(b)(vi)']);
      expect(s.questions[0].subQuestions![3].coIds).toEqual(['co-ns-4']);
      expect(s.questions[1].attemptRule).toEqual({ attempt: 4, outOf: 5 });
    });

    it('reopening drops the marksheet and locks it again, until the marksheet is finalized', () => {
      const store = new FacultyWorkspaceMockStore();
      const confirmed = store.papers.finalize(ISE3, analyse(store, store.papers.paper(ISE3).version).version);
      const reopened = store.papers.reopen(ISE3, confirmed.version);
      expect(reopened.status).toBe('ANALYSIS_READY');
      expect(store.papers.result(ISE3).subQuestions.length).toBe(11); // the review stays
      expect(store.offering(COURSE).progress.cycles[4].steps.marksheet.status).toBe('LOCKED');
      expect(() => store.marksheets.structure(ISE3)).toThrowError(/Confirm the question paper first/);

      const again = store.papers.finalize(ISE3, reopened.version);
      store.marksheets.finalize(ISE3, store.marksheets.structure(ISE3).version);
      expect(() => store.papers.reopen(ISE3, again.version)).toThrowError(/marksheet is finalized/);
    });

    it('finalizing the marksheet fills the ISE-3 block of the workbook and opens marks entry', () => {
      const store = new FacultyWorkspaceMockStore();
      const block = () => store.workbook(COURSE).data.blocks.find(b => b.assessmentId === ISE3)!;
      expect(block().questions).toEqual([]);
      store.papers.finalize(ISE3, analyse(store, store.papers.paper(ISE3).version).version);
      expect(block().status).toBe('AWAITING_MARKSHEET');

      store.marksheets.finalize(ISE3, store.marksheets.structure(ISE3).version);
      const b = block();
      expect(b.status).toBe('AWAITING_MARKS');
      expect(b.questions.length).toBe(11);
      expect(b.questions[0]).toEqual({ label: 'Q1(a)(i)', maxMarks: 1, coCodes: ['CO3'], appliesToAllCos: false });
      expect(b.questions[3].coCodes).toEqual(['CO4']);
      expect(b.questions[10]).toEqual({ label: 'Q2(v)', maxMarks: 6, coCodes: ['CO3'], appliesToAllCos: false });
      const cycle = store.offering(COURSE).progress.cycles[4];
      expect(cycle.steps.marksheet.status).toBe('DONE');
      expect(cycle.steps.marksEntry.status).toBe('AVAILABLE');
      expect(store.offering(COURSE).progress.nextAction?.step).toBe('MARKS_ENTRY');
    });

    it('builds the demo workbook from the CAM and the earlier marksheets, with their submitted marks', () => {
      const store = new FacultyWorkspaceMockStore();
      const wb = store.workbook(COURSE);
      expect(wb.main.coSummary.map(c => c.coCode)).toEqual(['CO1', 'CO2', 'CO3', 'CO4']);
      expect(wb.poPso.outcomes.length).toBe(15);
      expect(wb.data.blocks.find(b => b.assessmentId === 'as-nsf-1')!.status).toBe('FILLED');
      expect(wb.data.studentCount).toBe(30);
      const row = store.workbookStudents(COURSE, 0, 1).content[0];
      expect(Object.keys(row.marks)).toEqual(['as-nsf-1', 'as-nsf-2', 'as-nsf-3', 'as-nsf-4']);
    });

    it('fills the college moderation sheet from the paper and leaves the moderator part blank', () => {
      const store = new FacultyWorkspaceMockStore();
      expect(() => store.papers.moderationSheet(ISE3, 'PDF')).toThrowError(/Validate the paper/);
      const paper = analyse(store, store.papers.paper(ISE3).version);
      expect(markingScheme(paper)).toEqual([{ q: '1', co: '3, 4', marks: 6 }, { q: '2', co: '3', marks: 24 }]);
      expect(moderationRowLabels(paper)).toEqual(['Q 1-i', 'Q 1-ii', 'Q 1-iii', 'Q 1-iv', 'Q 1-v', 'Q 1-vi', 'Q 2-i', 'Q 2-ii', 'Q 2-iii', 'Q 2-iv', 'Q 2-v']);

      const html = moderationSheetHtml({
        institution: 'Walchand Institute of Technology, Solapur', department: 'Electronics and Computer Engineering',
        semesterNumber: 7, academicYear: '2026-27', yearOfStudy: 'Final Year', courseCode: '23ECU7E1T',
        courseName: 'Network Security', setterName: 'Rohan Belsare', submittedOn: '2026-10-06T09:00:00Z',
      }, paper, false);
      expect(html).toContain('Odd Semester, 2026-27');
      expect(html).toContain('ISE Test: I / II / III : <b>III</b>');
      expect(html).toContain('Final Year - VII');
      expect(html).toContain('Total number of Questions: 02');
      expect(html).toContain('Date of Submission of Question Paper: 06 Oct 2026');
      expect(html).toContain('Date of Moderation:</td>');
      expect(html).toContain('<i>Rohan Belsare</i>');
      expect(html).not.toContain('Aligned');

      const file = store.papers.moderationSheet(ISE3, 'DOCX');
      expect(file.fileName).toBe('23ECU7E1T_ISE-3_SetA_moderation_sheet.doc');
    });

    it('has no moderation sheet for an ESE paper', () => {
      const store = new FacultyWorkspaceMockStore();
      expect(() => store.papers.moderationSheet('as-nsf-6', 'PDF')).toThrowError(/Waiting for ISE-3/);
    });

    it('keeps locked cycles and activities out of reach', () => {
      const store = new FacultyWorkspaceMockStore();
      expect(() => store.papers.paper('as-nsf-6')).toThrowError(/Waiting for ISE-3/);
      expect(() => store.papers.paper('as-nsf-2')).toThrowError(/Only ISE and ESE/);
    });

    it('opens a blank paper for the first cycle once a CAM is finalized', () => {
      const store = new FacultyWorkspaceMockStore();
      expect(() => store.papers.paper('as-ns-1')).toThrowError(/Finalize the CAM first/);
    });
  });

  describe('PaperDraft', () => {
    const fresh = () => {
      const store = new FacultyWorkspaceMockStore();
      const draft = new PaperDraft();
      draft.reset(store.papers.paper(ISE3));
      return { store, draft };
    };

    it('starts clean, becomes dirty on an edit and round-trips the seeded paper', () => {
      const { store, draft } = fresh();
      expect(draft.dirty()).toBeFalse();
      expect(draft.toUpdate(2).questions).toEqual(store.papers.paper(ISE3).questions);
      draft.patchSub({ qi: 1, pi: null, si: 0 }, { marks: 5 });
      expect(draft.dirty()).toBeTrue();
      expect(draft.totalPreview()).toBe(30); // still the best four of five
    });

    it('continues sub-question labels across parts and copies the previous type', () => {
      const { draft } = fresh();
      draft.addSub(0, 1);
      const added = draft.questions()[0].parts![1].subQuestions.at(-1)!;
      expect(added.label).toBe('vii');
      expect(added.type).toBe('MCQ');
      expect(added.options!.map(o => o.key)).toEqual(['A', 'B', 'C', 'D']);
    });

    it('keeps an attempt rule in step with the number of sub-questions', () => {
      const { draft } = fresh();
      draft.addSub(1, null);
      expect(draft.questions()[1].attemptRule).toEqual({ attempt: 4, outOf: 6 });
      draft.removeSub({ qi: 1, pi: null, si: 0 });
      draft.removeSub({ qi: 1, pi: null, si: 0 });
      draft.removeSub({ qi: 1, pi: null, si: 0 });
      expect(draft.questions()[1].attemptRule).toEqual({ attempt: 3, outOf: 3 });
    });

    it('moves sub-questions into part (a) and back', () => {
      const { draft } = fresh();
      draft.setUseParts(1, true);
      const q = draft.questions()[1];
      expect(q.coId).toBeUndefined();
      expect(q.parts![0]).toEqual(jasmine.objectContaining({ label: 'a', coId: 'co-ns-3' }));
      expect(q.parts![0].subQuestions.length).toBe(5);
      draft.setUseParts(1, false);
      expect(draft.questions()[1].coId).toBe('co-ns-3');
      expect(draft.questions()[1].subQuestions!.length).toBe(5);
    });

    it('drops MCQ options when a sub-question becomes descriptive and re-letters removed options', () => {
      const { draft } = fresh();
      const path = { qi: 0, pi: 0, si: 0 };
      draft.removeOption(path, 1);
      expect(draft.questions()[0].parts![0].subQuestions[0].options!.map(o => [o.key, o.text]))
        .toEqual([['A', 'SSL'], ['B', 'PGP'], ['C', 'S/MIME']]);
      draft.setType(path, 'DESCRIPTIVE');
      expect(draft.toUpdate(0).questions[0].parts![0].subQuestions[0].options).toBeUndefined();
    });
  });
});
