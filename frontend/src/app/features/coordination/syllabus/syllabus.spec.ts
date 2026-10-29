import { CoordinationMockStore } from '../../../core/mocks/coordination.mock';
import { BUILT_IN_GROUPS, loadIssues } from '../../../core/mocks/load-distribution.rules';
import { MockError } from '../../../core/mocks/mock-error';
import { LoadRow } from '../../../core/models/coordination.model';
import { blankRow, dash, itemsSummary } from './load-helpers';

function errorOf(fn: () => unknown): MockError {
  try { fn(); } catch (e) { return e as MockError; }
  throw new Error('expected an error');
}

const GROUPS = BUILT_IN_GROUPS.map(g => g.code);
const theory = (over: Partial<LoadRow> = {}): LoadRow => ({
  ...blankRow('THEORY'), rowId: 'r1', courseCode: 'X1', courseName: 'Course', hours: { lecture: 3, tutorial: 0, practical: 0 }, credits: 3,
  components: {
    ese: { totalMarks: 60, items: [{ category: 'ESE', count: 1, maxMarksEach: 60 }] },
    oePoe: { totalMarks: 0, items: [] },
    ise: { totalMarks: 40, items: [{ category: 'ISE', count: 2, maxMarksEach: 15 }, { category: 'ACTIVITY', count: 2, maxMarksEach: 5 }] },
    ica: { totalMarks: 0, items: [] },
  },
  ...over,
});
const codes = (rows: LoadRow[]) => loadIssues(rows, GROUPS).map(i => i.code);

describe('Syllabus load distribution (API_CONTRACT v2.8 §15.4)', () => {
  let store: CoordinationMockStore;
  let s7: string;
  beforeEach(() => {
    store = new CoordinationMockStore({ demoHistory: false });
    s7 = store.overview().semesters.find(s => s.semesterNumber === 7)!.setup!.setupId;
  });

  const fillPsos = () => {
    const psos = store.outcomes('PSO');
    store.saveOutcomes('PSO', { version: psos.version, items: psos.items.map(o => ({ code: o.code, statement: `${o.code} statement` })) });
  };

  describe('the seeded ECE Semester VII', () => {
    it('matches the college table: theory 550, laboratory 250, grand total 800', () => {
      const l = store.loadDistribution(s7);
      expect(l.issues).toEqual([]);
      expect(l.totals.theory).toEqual({ lecture: 13, tutorial: 2, practical: 0, credits: 15, ese: 300, oePoe: 0, ise: 200, ica: 50, total: 550 });
      expect(l.totals.laboratory).toEqual({ lecture: 0, tutorial: 0, practical: 14, credits: 7, ese: 0, oePoe: 75, ise: 0, ica: 175, total: 250 });
      expect([l.totals.grand.credits, l.totals.grand.total]).toEqual([22, 800]);
    });

    it('derives each row\'s scheme: practical when it has neither ESE nor ISE', () => {
      const scheme = (code: string) => store.loadDistribution(s7).rows.find(r => r.courseCode === code)!.assessmentScheme;
      expect([scheme('23ECU7CC1T'), scheme('23ECU7CC2A'), scheme('23ECU7CC1L')]).toEqual(['THEORY', 'PRACTICAL', 'PRACTICAL']);
    });
  });

  describe('blocking issues (§15.4.2)', () => {
    it('accepts a complete row', () => expect(codes([theory()])).toEqual([]));

    it('needs at least one course', () => expect(codes([])).toEqual(['EMPTY_SYLLABUS']));

    it('checks that a column\'s items add up to its total', () => {
      const r = theory();
      r.components.ise.totalMarks = 50;
      expect(codes([r])).toEqual(['COLUMN_SUM_MISMATCH']);
      expect(loadIssues([r], GROUPS)[0].message).toContain('add up to 40, not 50');
    });

    it('only allows each column\'s categories, and a single exam for ESE and OE/POE', () => {
      const a = theory(); a.components.ise.items[1].category = 'PRACTICAL';
      const b = theory(); b.components.ese = { totalMarks: 60, items: [{ category: 'ESE', count: 2, maxMarksEach: 30 }] };
      expect(codes([a])).toEqual(['CATEGORY_NOT_ALLOWED']);
      expect(codes([b])).toEqual(['CATEGORY_NOT_ALLOWED']);
    });

    it('treats 0 as "the course doesn\'t have this component"', () => {
      const a = theory(); a.components.ise = { totalMarks: 0, items: [{ category: 'ISE', count: 1, maxMarksEach: 10 }] };
      const none = theory(); none.components.ese = { totalMarks: 0, items: [] }; none.components.ise = { totalMarks: 0, items: [] };
      expect(codes([a])).toEqual(['ITEMS_WITHOUT_MARKS']);
      expect(codes([none])).toEqual(['NO_ASSESSMENT']);
    });

    it('checks codes, groups, hours and credits', () => {
      expect(codes([theory(), theory({ rowId: 'r2', courseCode: 'x1' })])).toEqual(['DUPLICATE_COURSE_CODE', 'DUPLICATE_COURSE_CODE']);
      expect(codes([theory({ groupCode: 'XYZ', courseName: ' ' })])).toEqual(['MISSING_FIELD', 'MISSING_FIELD']);
      expect(codes([theory({ hours: { lecture: 2.5, tutorial: 0, practical: 0 } })])).toEqual(['INVALID_HOURS']);
      expect(codes([theory({ credits: 2.25 })])).toEqual(['INVALID_CREDITS']);
    });

    it('needs a slot to list options, at least one running, with codes not used elsewhere', () => {
      expect(codes([theory({ options: [] })])).toEqual(['SLOT_WITHOUT_OPTIONS']);
      expect(codes([theory({ options: [{ courseCode: 'E1', courseName: 'A', offered: false }] })])).toEqual(['NO_OFFERED_OPTION']);
      expect(codes([theory({ options: [{ courseCode: 'X1', courseName: 'A', offered: true }] })]))
        .toEqual(['DUPLICATE_COURSE_CODE', 'DUPLICATE_OPTION_CODE']);
    });
  });

  describe('saving the table (CRD-20)', () => {
    it('assigns IDs, recomputes totals and bumps the version', () => {
      const id = store.createSetup({ academicYearId: 'ay-2026-27', semesterNumber: 3 }).setupId;
      const v = store.loadDistribution(id).version;
      const saved = store.saveLoadDistribution(id, { version: v, rows: [{ ...theory(), rowId: undefined, totalMarks: 999 }] });
      expect(saved.version).toBe(v + 1);
      expect(saved.rows[0].rowId).toBeTruthy();
      expect(saved.rows[0].totalMarks).toBe(100);
      expect(saved.totals.grand.total).toBe(100);
      expect(store.setup(id).steps.find(s => s.key === 'SYLLABUS')!.state.status).toBe('DONE');
    });

    it('rejects a stale version', () => {
      const l = store.loadDistribution(s7);
      store.saveLoadDistribution(s7, { version: l.version, rows: l.rows });
      expect(errorOf(() => store.saveLoadDistribution(s7, { version: l.version, rows: l.rows })).errorCode).toBe('VERSION_CONFLICT');
    });

    it('saves a table with issues but keeps the step open', () => {
      const id = store.createSetup({ academicYearId: 'ay-2026-27', semesterNumber: 3 }).setupId;
      const r = theory({ rowId: undefined }); r.components.ise.totalMarks = 45;
      const saved = store.saveLoadDistribution(id, { version: 1, rows: [r] });
      expect(saved.issues.length).toBe(1);
      expect(store.setup(id).steps.find(s => s.key === 'SYLLABUS')!.state.status).toBe('IN_PROGRESS');
    });
  });

  describe('declaration and revision (CRD-21, CRD-22)', () => {
    it('can\'t be declared before the department\'s PSOs are filled', () => {
      const e = errorOf(() => store.declare(s7, { version: store.loadDistribution(s7).version, confirmed: true }));
      expect([e.status, e.errorCode]).toEqual([409, 'STAGE_LOCKED']);
      expect(e.message).toContain('PSOs');
    });

    it('needs the confirmation ticked, then records who declared which version and locks the table', () => {
      fillPsos();
      const v = store.loadDistribution(s7).version;
      expect(errorOf(() => store.declare(s7, { version: v, confirmed: false })).fieldErrors?.['confirmed']).toBeTruthy();

      const l = store.declare(s7, { version: v, confirmed: true });
      expect(l.status).toBe('DECLARED');
      expect(l.declaration).toEqual(jasmine.objectContaining({
        syllabusVersion: 1, declaredBy: jasmine.objectContaining({ fullName: 'Sneha Kulkarni' }), semesterNumber: 7,
      }));
      expect(l.declaration!.statement).toContain('Syllabus Load Distribution');
      expect(store.setup(s7).steps.map(s => s.state.status)).toEqual(['DONE', 'DONE', 'DONE', 'DONE', 'AVAILABLE', 'LOCKED']);
      expect(errorOf(() => store.saveLoadDistribution(s7, { version: l.version, rows: l.rows })).errorCode).toBe('SYLLABUS_LOCKED');
      expect(errorOf(() => store.declare(s7, { version: l.version, confirmed: true })).errorCode).toBe('INVALID_STATE');
    });

    it('starts a new draft version with a reason, keeping the rows', () => {
      fillPsos();
      expect(errorOf(() => store.revise(s7, { version: store.loadDistribution(s7).version, reason: 'x' })).errorCode).toBe('INVALID_STATE');
      const declared = store.declare(s7, { version: store.loadDistribution(s7).version, confirmed: true });
      expect(errorOf(() => store.revise(s7, { version: declared.version, reason: '  ' })).status).toBe(400);

      const v2 = store.revise(s7, { version: declared.version, reason: 'Wrong ICA marks' });
      expect([v2.syllabusVersion, v2.status, v2.declaration, v2.rows.length]).toEqual([2, 'DRAFT', undefined, declared.rows.length]);
      expect(store.setup(s7).syllabusVersion).toBe(2);
      expect(store.setup(s7).steps.find(s => s.key === 'DECLARATION')!.state.status).toBe('AVAILABLE');
    });
  });

  describe('course groups (CRD-23, CRD-24)', () => {
    it('lists the built-in groups and adds department ones once', () => {
      expect(store.courseGroups().map(g => g.code)).toEqual(['PCC', 'PEC', 'MDM', 'RM', 'OJT', 'CAP']);
      expect(store.addCourseGroup({ code: 'oe', name: 'Open Elective' })).toEqual({ code: 'OE', name: 'Open Elective', builtIn: false });
      expect(errorOf(() => store.addCourseGroup({ code: 'OE', name: 'Again' })).errorCode).toBe('DUPLICATE_CODE');
      expect(errorOf(() => store.addCourseGroup({ code: '1', name: '' })).fieldErrors).toEqual(jasmine.objectContaining({ code: jasmine.any(String), name: jasmine.any(String) }));
    });
  });

  describe('POs and PSOs (CRD-25 to CRD-29)', () => {
    it('keeps exactly 11 POs and 3 PSOs with fixed codes, versioned', () => {
      const pos = store.outcomes('PO');
      expect(pos.items.map(o => o.code)).toEqual(['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11']);
      expect(errorOf(() => store.saveOutcomes('PO', { version: pos.version, items: pos.items.slice(0, 10) })).status).toBe(400);

      const psos = store.outcomes('PSO');
      const e = errorOf(() => store.saveOutcomes('PSO', { version: psos.version, items: psos.items.map(o => ({ code: o.code, statement: '' })) }));
      expect(Object.keys(e.fieldErrors ?? {})).toEqual(['items[0].statement', 'items[1].statement', 'items[2].statement']);

      fillPsos();
      expect(store.outcomes('PSO').version).toBe(psos.version + 1);
      expect(store.outcomeVersions('PSO').length).toBe(1);
      expect(store.overview().outcomesComplete).toBeTrue();
      expect(errorOf(() => store.saveOutcomes('PSO', { version: psos.version, items: [] })).errorCode).toBe('VERSION_CONFLICT');
    });
  });

  describe('presentation helpers', () => {
    it('prints zero as "--" and summarises how a column is earned', () => {
      expect([dash(0), dash(25)]).toEqual(['--', '25']);
      expect(itemsSummary(theory().components.ise)).toBe('2 ISE tests × 15 + 2 activities × 5');
    });
  });
});
