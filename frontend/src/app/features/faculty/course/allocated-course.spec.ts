import { CoordinationMockStore } from '../../../core/mocks/coordination.mock';
import { FacultyWorkspaceMockStore } from '../../../core/mocks/faculty-workspace.mock';
import { MockError } from '../../../core/mocks/mock-error';

function errorOf(fn: () => unknown): MockError {
  try { fn(); } catch (e) { return e as MockError; }
  throw new Error('expected an error');
}

describe('Allocated courses on the faculty side (API_CONTRACT v2.8 §7, §8, §9)', () => {
  let coordination: CoordinationMockStore;
  let ws: FacultyWorkspaceMockStore;
  let me: string;
  let dsp: string;
  let lab: string;

  beforeEach(() => {
    coordination = new CoordinationMockStore();
    me = 'faculty@wit.edu';
    ws = new FacultyWorkspaceMockStore(coordination, () => me);
    const mine = ws.dashboard().offerings.filter(o => o.allocation.status === 'PENDING_ACCEPTANCE');
    dsp = mine.find(o => o.course.courseCode === '23ECU5CC1T')!.offeringId;
    lab = mine.find(o => o.course.courseCode === '23ECU5CC1L')!.offeringId;
  });

  describe('accepting the allocation (FAC-4)', () => {
    it('lists the coordinator\'s completed allocations as courses waiting to be accepted', () => {
      const d = ws.dashboard();
      const o = ws.offering(dsp);
      expect([o.semester.semesterNumber, o.className, o.allocation.allocatedBy]).toEqual([5, 'Third Year B.Tech ECM', 'Sneha Kulkarni']);
      expect(o.progress.setup.subjectSelection.status).toBe('AVAILABLE');
      expect(o.progress.setup.assessmentPlan).toEqual(jasmine.objectContaining({ status: 'LOCKED' }));
      expect(d.attention.some(a => a.offeringId === dsp && a.step === 'SUBJECT_SELECTION')).toBeTrue();
    });

    it('shows a course only to the faculty member it is allocated to', () => {
      me = 'coordinator@wit.edu';
      expect(ws.dashboard().offerings.some(o => o.offeringId === dsp)).toBeFalse();
      expect(errorOf(() => ws.offering(dsp)).status).toBe(403);
    });

    it('records the acceptance for the coordinator and opens the plan', () => {
      const o = ws.accept(dsp);
      expect(o.allocation.status).toBe('ACCEPTED');
      expect(o.progress.setup.subjectSelection.status).toBe('DONE');
      expect(o.progress.setup.assessmentPlan.status).toBe('AVAILABLE');
      const sem5 = coordination.overview().semesters.find(s => s.semesterNumber === 5)!.setup!;
      expect(sem5.subjects.accepted).toBe(3);
      expect(errorOf(() => ws.accept(dsp)).errorCode).toBe('ALREADY_FINALIZED');
    });
  });

  describe('the generated assessment plan (PLAN-1)', () => {
    it('has one assessment per item in the load distribution, ISE tests and activities alternating', () => {
      const p = ws.plan(dsp);
      expect(p.assessments.map(a => [a.order, a.name, a.maxMarks])).toEqual([
        [1, 'ISE-1', 15], [2, 'Activity 1', 5], [3, 'ISE-2', 15], [4, 'Activity 2', 5], [5, 'ESE', 60],
      ]);
      expect(p.examinationScheme.components).toEqual([{ type: 'ESE', maxMarks: 60 }, { type: 'ISE', maxMarks: 40 }]);
      expect(p.issues.map(i => i.code)).toEqual(['ACTIVITY_TYPE_MISSING', 'ACTIVITY_TYPE_MISSING']);
    });

    it('gives a laboratory course only its practicals and POE', () => {
      const p = ws.plan(lab);
      expect(p.assessments.map(a => a.name)).toEqual(['Practical 1', 'Practical 2', 'Practical 3', 'Practical 4', 'Practical 5', 'POE']);
      expect(p.assessments.map(a => a.phase)).toEqual(['ISE', 'ISE', 'ISE', 'ISE', 'ISE', 'ESE']);
      expect(p.examinationScheme.components.map(c => c.type)).toEqual(['POE', 'ICA']);
    });

    it('can be read before acceptance but not changed', () => {
      const p = ws.plan(dsp);
      const body = { version: p.version, assessments: p.assessments.map(a => ({ assessmentId: a.assessmentId, order: a.order })) };
      expect(errorOf(() => ws.savePlan(dsp, body)).errorCode).toBe('STAGE_LOCKED');
    });
  });

  describe('editing and finalizing the plan (PLAN-2, PLAN-3)', () => {
    beforeEach(() => ws.accept(dsp));

    it('changes only order, dates and activity types', () => {
      const p = ws.plan(dsp);
      const ids = p.assessments.map(a => a.assessmentId);
      expect(errorOf(() => ws.savePlan(dsp, { version: p.version, assessments: ids.slice(1).map((assessmentId, i) => ({ assessmentId, order: i + 1 })) })).status).toBe(400);
      expect(errorOf(() => ws.savePlan(dsp, { version: p.version, assessments: ids.map(assessmentId => ({ assessmentId, order: 1 })) })).status).toBe(400);
      expect(errorOf(() => ws.savePlan(dsp, { version: p.version, assessments: ids.map((assessmentId, i) => ({ assessmentId, order: i + 1, activityType: 'CASE_STUDY' as const })) })).fieldErrors)
        .toEqual(jasmine.objectContaining({ 'assessments[0].activityType': jasmine.any(String) }));

      const reordered = [ids[1], ids[0], ids[2], ids[3], ids[4]];
      const saved = ws.savePlan(dsp, {
        version: p.version,
        assessments: reordered.map((assessmentId, i) => ({
          assessmentId, order: i + 1, plannedDate: '2026-08-20',
          ...(assessmentId.includes('activity') ? { activityType: 'MINI_PROJECT' as const } : {}),
        })),
      });
      expect(saved.assessments.map(a => a.name)).toEqual(['Activity 1', 'ISE-1', 'ISE-2', 'Activity 2', 'ESE']);
      expect(saved.issues).toEqual([]);
      expect(errorOf(() => ws.savePlan(dsp, { version: p.version, assessments: [] })).errorCode).toBe('VERSION_CONFLICT');
    });

    it('refuses to finalize with issues, then makes the cycles and the CAM', () => {
      let p = ws.plan(dsp);
      expect(errorOf(() => ws.finalizePlan(dsp, p.version)).status).toBe(422);
      p = ws.savePlan(dsp, { version: p.version, assessments: p.assessments.map(a => ({ assessmentId: a.assessmentId, order: a.order, activityType: a.category === 'ACTIVITY' ? 'ASSIGNMENT' as const : undefined })) });
      ws.finalizePlan(dsp, p.version);

      const o = ws.offering(dsp);
      expect(o.progress.setup.assessmentPlan.status).toBe('DONE');
      expect(o.progress.setup.cam.status).toBe('AVAILABLE');
      expect(o.progress.cycles.map(c => [c.name, c.requiresPaperValidation])).toEqual([
        ['ISE-1', true], ['Activity 1', false], ['ISE-2', true], ['Activity 2', false], ['ESE', true],
      ]);
      const cam = ws.cams.cam(dsp);
      expect(cam.inputs.programOutcomes.filter(x => x.kind === 'PO').length).toBe(11);
      expect(cam.inputs.programOutcomes.filter(x => x.kind === 'PSO').map(x => x.title)).toEqual(['Embedded and IoT systems', 'Signals and communication', 'Computing and security']);
      expect(cam.inputs.activities.map(i => i.title)).toEqual(['Activity 1', 'Activity 2']);
      expect(errorOf(() => ws.finalizePlan(dsp, ws.plan(dsp).version)).errorCode).toBe('ALREADY_FINALIZED');
    });

    it('gives a laboratory course no paper validation at all', () => {
      ws.accept(lab);
      ws.finalizePlan(lab, ws.plan(lab).version);
      const cycles = ws.offering(lab).progress.cycles;
      expect(cycles.length).toBe(6);
      expect(cycles.every(c => !c.requiresPaperValidation)).toBeTrue();
      expect(ws.cams.cam(lab).inputs.practicals.length).toBe(5);
    });
  });

  describe('the CAM (§9)', () => {
    it('keeps items fixed and saves the POs and PSOs the faculty edits', () => {
      ws.accept(lab);
      ws.finalizePlan(lab, ws.plan(lab).version);
      const cam = ws.cams.cam(lab);
      const base = { version: cam.version, unitLinks: [], cells: [] };
      expect(errorOf(() => ws.cams.save(lab, { ...base, inputs: { ...cam.inputs, practicals: cam.inputs.practicals.slice(1) } })).status).toBe(400);
      // A new CAM starts from the coordinator's 11 POs and 3 PSOs; the faculty can change them.
      expect(cam.inputs.programOutcomes.map(o => o.code)).toEqual([
        'PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PSO1', 'PSO2', 'PSO3',
      ]);
      const edited = cam.inputs.programOutcomes.map(o => o.code === 'PSO1' ? { ...o, statement: 'Design secure embedded systems.' } : o);
      ws.cams.save(lab, { ...base, inputs: { ...cam.inputs, programOutcomes: edited } });
      const reread = ws.cams.cam(lab).inputs.programOutcomes;
      expect(reread.find(o => o.code === 'PSO1')!.statement).toBe('Design secure embedded systems.');
      expect(reread.length).toBe(14);
    });
  });
});
