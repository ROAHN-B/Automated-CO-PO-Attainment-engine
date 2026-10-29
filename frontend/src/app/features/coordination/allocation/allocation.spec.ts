import { CoordinationMockStore } from '../../../core/mocks/coordination.mock';
import { MockError } from '../../../core/mocks/mock-error';
import { AllocatableSubject } from '../../../core/models/coordination.model';

function errorOf(fn: () => unknown): MockError {
  try { fn(); } catch (e) { return e as MockError; }
  throw new Error('expected an error');
}

describe('Subject allocation and completion (API_CONTRACT v2.8 §15.6, §15.7)', () => {
  let store: CoordinationMockStore;
  let s7: string;
  let faculty: { userId: string; fullName: string; credentialStatus: string }[];

  const fillPsos = () => {
    const p = store.outcomes('PSO');
    store.saveOutcomes('PSO', { version: p.version, items: p.items.map(o => ({ code: o.code, statement: `${o.code} statement` })) });
  };
  const declare = (id: string) => store.declare(id, { version: store.loadDistribution(id).version, confirmed: true });
  const subjects = (id: string): AllocatableSubject[] => store.allocationBoard(id).subjects;
  const assignAll = (id: string) => subjects(id).forEach((s, i) =>
    s.divisions.forEach(d => store.createAllocation({ setupId: id, subjectKey: s.subjectKey, division: d.division, facultyUserId: faculty[i % 4].userId })));

  beforeEach(() => {
    store = new CoordinationMockStore({ demoHistory: false });
    s7 = store.overview().semesters.find(s => s.semesterNumber === 7)!.setup!.setupId;
    faculty = store.facultyList({ size: 100 }).content;
  });

  it('needs a declared syllabus before anything is allocated', () => {
    const s = subjects(s7)[0];
    const e = errorOf(() => store.createAllocation({ setupId: s7, subjectKey: s.subjectKey, facultyUserId: faculty[0].userId }));
    expect([e.status, e.errorCode]).toEqual([409, 'STAGE_LOCKED']);
  });

  describe('once Semester VII is declared', () => {
    beforeEach(() => { fillPsos(); declare(s7); });

    it('lists one subject per course that needs faculty, and per running elective option', () => {
      const list = subjects(s7);
      expect(list.length).toBe(13);
      expect(list.filter(s => s.slotName === 'Programme Elective Course IV').map(s => s.course.courseName))
        .toEqual(['Electric Vehicle Technology', 'Network Security']);
      expect(list.some(s => s.course.courseCode.includes('MD6'))).toBeFalse();
      expect(store.allocationBoard(s7).blockers.filter(b => b.code === 'UNASSIGNED').length).toBe(13);
    });

    it('allows one faculty member per subject, checks the division and refuses inactive faculty', () => {
      const s = subjects(s7)[0];
      store.createAllocation({ setupId: s7, subjectKey: s.subjectKey, facultyUserId: faculty[0].userId });
      expect(errorOf(() => store.createAllocation({ setupId: s7, subjectKey: s.subjectKey, facultyUserId: faculty[1].userId })).errorCode).toBe('ALREADY_ALLOCATED');
      expect(errorOf(() => store.createAllocation({ setupId: s7, subjectKey: subjects(s7)[1].subjectKey, division: 'A', facultyUserId: faculty[1].userId })).status).toBe(400);
      expect(errorOf(() => store.createAllocation({ setupId: s7, subjectKey: 'nope', facultyUserId: faculty[1].userId })).status).toBe(404);
      store.updateFaculty(faculty[2].userId, { status: 'INACTIVE' });
      expect(errorOf(() => store.createAllocation({ setupId: s7, subjectKey: subjects(s7)[1].subjectKey, facultyUserId: faculty[2].userId })).status).toBe(422);
    });

    it('gives one faculty member several subjects across semesters, as separate records', () => {
      const s5 = store.createSetup({ academicYearId: 'ay-2026-27', semesterNumber: 5 }).setupId;
      const row = store.loadDistribution(s7).rows[0];
      store.saveLoadDistribution(s5, { version: 1, rows: [{ ...row, rowId: undefined, courseCode: '23ECU5CC1T', courseName: 'Signals' }] });
      declare(s5);

      const who = faculty[1].userId;
      store.createAllocation({ setupId: s7, subjectKey: subjects(s7)[0].subjectKey, facultyUserId: who });
      store.createAllocation({ setupId: s7, subjectKey: subjects(s7)[1].subjectKey, facultyUserId: who });
      store.createAllocation({ setupId: s5, subjectKey: subjects(s5)[0].subjectKey, facultyUserId: who });

      const load = store.facultyLoad().find(l => l.faculty.userId === who)!;
      expect(load.allocations.map(a => [a.semesterNumber, a.courseCode])).toEqual([[5, '23ECU5CC1T'], [7, '23ECU7CC1T'], [7, '23ECU7CC2T']]);
      expect(load.weeklyHours).toBe(2 + 2 + 3);
      expect(store.allocationBoard(s5).summary.assigned).toBe(1);
      expect(store.allocationBoard(s7).summary.assigned).toBe(2);
      expect(store.facultyList({ search: faculty[1].fullName }).content[0].allocationCount).toBe(3);
    });

    it('needs a faculty member per division', () => {
      store.updateSetup(s7, { version: store.setup(s7).version, divisions: ['A', 'B'] });
      expect(store.allocationBoard(s7).summary.subjects).toBe(26);
      expect(store.overview().semesters.find(s => s.semesterNumber === 7)!.setup!.subjects.configured).toBe(26);
    });

    it('refuses to complete while anything is unassigned', () => {
      const e = errorOf(() => store.completeAllocation(s7, { version: store.setup(s7).version }));
      expect([e.status, e.errorCode]).toEqual([409, 'ALLOCATION_INCOMPLETE']);
      expect(e.message).toContain('has no faculty member');
    });

    describe('completing (CRD-31)', () => {
      beforeEach(() => {
        assignAll(s7);
        expect(store.setup(s7).steps.slice(4).map(s => s.state.status)).toEqual(['DONE', 'AVAILABLE']);
        store.completeAllocation(s7, { version: store.setup(s7).version });
      });

      it('sets every subject pending, creates the offerings and completes the setup', () => {
        const b = store.allocationBoard(s7);
        expect(b.status).toBe('COMPLETED');
        expect(b.summary).toEqual({ subjects: 13, assigned: 13, unassigned: 0, pendingAcceptance: 13, accepted: 0 });
        expect(b.subjects.every(s => s.divisions[0].allocation!.offeringId)).toBeTrue();
        expect(store.setup(s7).status).toBe('COMPLETED');
        expect(store.overview().semesters.find(s => s.semesterNumber === 7)!.setup!.status).toBe('COMPLETED');
      });

      it('emails each faculty member once, with a set-password link only for those not activated', () => {
        const mails = store.notifications(s7);
        expect(mails.length).toBe(4);
        expect(new Set(mails.map(m => m.to.userId)).size).toBe(4);
        for (const m of mails) {
          const f = faculty.find(x => x.userId === m.to.userId)!;
          expect(m.includesSetPasswordLink).toBe(f.credentialStatus !== 'ACTIVATED');
          expect(m.subjectLine).toBe('Subject allocation — Semester VII, 2026-27');
          expect(m.body).toContain('open Setup and accept');
          expect(m.body).not.toMatch(/password\s*[:=]/i);
        }
        const invited = store.facultyList({ size: 100 }).content.filter(f => mails.some(m => m.to.userId === f.userId));
        expect(invited.every(f => f.credentialStatus === 'ACTIVATED' || f.credentialStatus === 'INVITE_SENT')).toBeTrue();
      });

      it('locks the syllabus, the divisions and deletions', () => {
        const a = store.allocationBoard(s7).subjects[0].divisions[0].allocation!;
        expect(errorOf(() => store.revise(s7, { version: store.loadDistribution(s7).version, reason: 'x' })).errorCode).toBe('SYLLABUS_IN_USE');
        expect(errorOf(() => store.updateSetup(s7, { version: store.setup(s7).version, divisions: ['A'] })).errorCode).toBe('INVALID_STATE');
        expect(errorOf(() => store.deleteAllocation(a.allocationId)).errorCode).toBe('INVALID_STATE');
        expect(errorOf(() => store.completeAllocation(s7, { version: store.setup(s7).version })).errorCode).toBe('INVALID_STATE');
      });

      it('reassigning emails the new and the previous faculty member', () => {
        const a = store.allocationBoard(s7).subjects[0].divisions[0].allocation!;
        const to = faculty.find(f => f.userId !== a.faculty.userId)!;
        const updated = store.updateAllocation(a.allocationId, { facultyUserId: to.userId });
        expect([updated.faculty.userId, updated.status]).toEqual([to.userId, 'PENDING_ACCEPTANCE']);
        const [removed, reassigned] = store.notifications(s7);
        expect([reassigned.kind, reassigned.to.userId]).toEqual(['REASSIGNED', to.userId]);
        expect([removed.kind, removed.to.userId, removed.includesSetPasswordLink]).toEqual(['REMOVED', a.faculty.userId, false]);
      });

      it('tracks acceptance, and reminds only while pending', () => {
        const a = store.allocationBoard(s7).subjects[0].divisions[0].allocation!;
        store.remind(a.allocationId);
        expect(store.notifications(s7)[0].kind).toBe('REMINDER');

        store.acceptAllocation(a.allocationId);
        expect(store.allocationBoard(s7).summary.accepted).toBe(1);
        expect(store.overview().semesters.find(s => s.semesterNumber === 7)!.setup!.subjects.accepted).toBe(1);
        expect(errorOf(() => store.remind(a.allocationId)).errorCode).toBe('INVALID_STATE');
        expect(errorOf(() => store.acceptAllocation(a.allocationId)).errorCode).toBe('ALREADY_FINALIZED');
      });
    });

    it('drops the draft allocations of a course removed in a revision', () => {
      const first = subjects(s7)[0];
      store.createAllocation({ setupId: s7, subjectKey: first.subjectKey, facultyUserId: faculty[0].userId });
      const v2 = store.revise(s7, { version: store.loadDistribution(s7).version, reason: 'Drop IoT' });
      store.saveLoadDistribution(s7, { version: v2.version, rows: v2.rows.slice(1) });
      expect(store.allocationBoard(s7).summary.assigned).toBe(0);
    });
  });
});
