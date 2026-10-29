import { CoordinationMockStore, normaliseDivisions, subjectCount } from '../../core/mocks/coordination.mock';
import { MockError } from '../../core/mocks/mock-error';
import { LoadRow } from '../../core/models/coordination.model';
import { roman, setupSteps, stepFromParam, termOf, yearOfStudy } from './setup-steps';

function errorOf(fn: () => unknown): MockError {
  try { fn(); } catch (e) { return e as MockError; }
  throw new Error('expected an error');
}

const blank = { totalMarks: 0, items: [] };
const row = (over: Partial<LoadRow> = {}): LoadRow => ({
  section: 'THEORY', groupCode: 'PCC', courseCode: 'X', courseName: 'X',
  hours: { lecture: 3, tutorial: 0, practical: 0 }, credits: 3,
  components: { ese: { totalMarks: 60, items: [{ category: 'ESE', count: 1, maxMarksEach: 60 }] }, oePoe: blank, ise: blank, ica: blank },
  totalMarks: 60, assessmentScheme: 'THEORY', needsFaculty: true, ...over,
});

describe('Coordinator semester setup (API_CONTRACT v2.8 §15.1)', () => {
  let store: CoordinationMockStore;
  beforeEach(() => { store = new CoordinationMockStore({ demoHistory: false }); });

  describe('overview', () => {
    it('always lists semesters III to VIII for the current year, with the seeded Semester VII', () => {
      const o = store.overview();
      expect(o.academicYear.name).toBe('2026-27');
      expect(o.semesters.map(s => s.semesterNumber)).toEqual([3, 4, 5, 6, 7, 8]);
      expect(o.semesters.filter(s => s.setup).map(s => s.semesterNumber)).toEqual([7]);
      expect(o.facultyCount).toBe(10);
    });

    it('reports the outcomes incomplete while the department has no PSOs', () => {
      expect(store.overview().outcomesComplete).toBeFalse();
    });

    it('scopes setups to the academic year', () => {
      expect(store.overview('ay-2025-26').semesters.every(s => !s.setup)).toBeTrue();
      expect(errorOf(() => store.overview('ay-1999')).status).toBe(404);
    });
  });

  describe('creating a setup (CRD-13)', () => {
    it('creates a semester with normalised divisions', () => {
      const s = store.createSetup({ academicYearId: 'ay-2026-27', semesterNumber: 5, divisions: [' a', 'B '] });
      expect(s.divisions).toEqual(['A', 'B']);
      expect(s.status).toBe('IN_PROGRESS');
      expect(store.overview().semesters.find(x => x.semesterNumber === 5)?.setup?.setupId).toBe(s.setupId);
    });

    it('refuses the first year and anything outside III to VIII', () => {
      for (const n of [1, 2, 9, 4.5]) {
        const e = errorOf(() => store.createSetup({ academicYearId: 'ay-2026-27', semesterNumber: n }));
        expect(e.status).withContext(String(n)).toBe(400);
      }
    });

    it('allows one setup per semester and year', () => {
      const e = errorOf(() => store.createSetup({ academicYearId: 'ay-2026-27', semesterNumber: 7 }));
      expect([e.status, e.errorCode]).toEqual([409, 'SETUP_EXISTS']);
      expect(() => store.createSetup({ academicYearId: 'ay-2025-26', semesterNumber: 7 })).not.toThrow();
    });

    it('rejects bad division names', () => {
      expect(errorOf(() => normaliseDivisions(['A', 'a'])).errorCode).toBe('VALIDATION_FAILED');
      expect(errorOf(() => normaliseDivisions(['Div A'])).errorCode).toBe('VALIDATION_FAILED');
      expect(normaliseDivisions(['', ' c '])).toEqual(['C']);
    });
  });

  describe('step order (server-enforced)', () => {
    it('starts a new semester with the faculty done and the syllabus open; everything after it is locked with a reason', () => {
      const id = store.createSetup({ academicYearId: 'ay-2026-27', semesterNumber: 5 }).setupId;
      const steps = store.setup(id).steps;
      expect(steps.map(s => s.key)).toEqual(['FACULTY', 'SYLLABUS', 'OUTCOMES', 'DECLARATION', 'ALLOCATION', 'COMPLETE']);
      expect(steps.map(s => s.state.status)).toEqual(['DONE', 'AVAILABLE', 'LOCKED', 'LOCKED', 'LOCKED', 'LOCKED']);
      expect(steps[2].state.lockedReason).toContain('syllabus');
      expect(steps[4].state.lockedReason).toContain('Declare');
      expect(store.overview().semesters.find(s => s.semesterNumber === 5)!.setup!.currentStep).toBe('SYLLABUS');
    });

    it('has the seeded Semester VII waiting for the department\'s PSOs', () => {
      const s7 = store.overview().semesters.find(s => s.semesterNumber === 7)!.setup!;
      expect(s7.currentStep).toBe('OUTCOMES');
      expect(s7.subjects).toEqual({ configured: 13, assigned: 0, accepted: 0 });
      expect(store.setup(s7.setupId).steps.find(s => s.key === 'DECLARATION')!.state.lockedReason).toContain('PSOs');
    });

    it('counts each offered option of a slot, and each division, as a subject', () => {
      const rows = [
        row(),
        row({ options: [
          { courseCode: 'E1', courseName: 'Electric Vehicle Technology', offered: true },
          { courseCode: 'E2', courseName: 'Network Security', offered: true },
          { courseCode: 'E3', courseName: 'Not run this year', offered: false },
        ] }),
        row({ needsFaculty: false }),
      ];
      expect(subjectCount(rows)).toBe(3);
    });
  });

  describe('editing divisions (CRD-15)', () => {
    it('saves with the current version and bumps it', () => {
      const id = store.overview().semesters.find(s => s.setup)!.setup!.setupId;
      const v = store.setup(id).version;
      const s = store.updateSetup(id, { version: v, divisions: ['A', 'B'] });
      expect([s.version, s.divisions]).toEqual([v + 1, ['A', 'B']]);
    });

    it('rejects a stale version', () => {
      const id = store.overview().semesters.find(s => s.setup)!.setup!.setupId;
      store.updateSetup(id, { version: 1, divisions: ['A'] });
      expect(errorOf(() => store.updateSetup(id, { version: 1, divisions: [] })).errorCode).toBe('VERSION_CONFLICT');
    });

    it('returns 404 for an unknown setup', () => {
      expect(errorOf(() => store.setup('nope')).status).toBe(404);
    });
  });

  describe('presentation helpers', () => {
    it('puts the creation step first and marks the first unfinished step as current', () => {
      const id = store.createSetup({ academicYearId: 'ay-2026-27', semesterNumber: 3 }).setupId;
      const views = setupSteps(store.setup(id));
      expect(views.length).toBe(7);
      expect(views[0]).toEqual(jasmine.objectContaining({ id: 'SEMESTER', number: 1, current: false }));
      expect(views.find(v => v.current)?.id).toBe('SYLLABUS');
    });

    it('names semesters the way the college does', () => {
      expect([roman(3), roman(8)]).toEqual(['III', 'VIII']);
      expect([yearOfStudy(4), yearOfStudy(5), yearOfStudy(7)]).toEqual(['Second year', 'Third year', 'Final year']);
      expect([termOf(7), termOf(8)]).toEqual(['Odd term', 'Even term']);
    });

    it('parses step keys from the URL safely', () => {
      expect(stepFromParam('syllabus')).toBe('SYLLABUS');
      expect(stepFromParam('semester')).toBe('SEMESTER');
      expect(stepFromParam('nonsense')).toBeNull();
      expect(stepFromParam(null)).toBeNull();
    });
  });
});
