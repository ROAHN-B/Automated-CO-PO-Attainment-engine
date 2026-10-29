import { CoordinationMockStore } from '../../core/mocks/coordination.mock';
import { FacultyWorkspaceMockStore } from '../../core/mocks/faculty-workspace.mock';

describe('POE demo courses (faculty@wit.edu)', () => {
  const store = (liveCourse = false) =>
    new FacultyWorkspaceMockStore(new CoordinationMockStore({ poeDemo: true }), () => 'faculty@wit.edu', { poeDemo: true, liveCourse });

  it('shows exactly Computer Networks and Network Security', () => {
    const d = store().dashboard();
    expect(d.offerings.map(o => o.course.courseName)).toEqual(['Computer Networks', 'Network Security']);
    expect(d.attention.map(a => a.step)).toEqual(['SUBJECT_SELECTION']);
  });

  it('has Computer Networks finished from the first step to close-out', () => {
    const p = store().offering('off-cs304').progress;
    const states = [
      ...Object.values(p.setup), ...p.cycles.flatMap(c => Object.values(c.steps)), ...Object.values(p.closeOut),
    ].map(s => s.status);
    expect(p.phase).toBe('SUBMITTED');
    expect(new Set(states)).toEqual(new Set(['DONE']));
    expect(p.nextAction).toBeUndefined();
  });

  it('starts Network Security at "Accept allocation" and pre-fills its CAM from the syllabus', () => {
    const ws = store();
    const id = ws.dashboard().offerings.find(o => o.course.courseName === 'Network Security')!.offeringId;
    expect(ws.offering(id).progress.setup.assessmentPlan.status).toBe('LOCKED');

    ws.accept(id);
    let plan = ws.plan(id);
    expect(plan.assessments.map(a => a.name)).toEqual(['ISE-1', 'Activity 1', 'ISE-2', 'Activity 2', 'ESE']);
    plan = ws.savePlan(id, {
      version: plan.version,
      assessments: plan.assessments.map(a => ({ assessmentId: a.assessmentId, order: a.order, ...(a.category === 'ACTIVITY' ? { activityType: 'MINI_PROJECT' as const } : {}) })),
    });
    ws.finalizePlan(id, plan.version);

    const cam = ws.cams.cam(id);
    expect([cam.inputs.courseOutcomes.length, cam.inputs.units.length, cam.inputs.activities.length]).toEqual([4, 6, 2]);
    expect(cam.inputs.programOutcomes.length).toBe(14);
    expect(ws.cams.suggestUnits(id).suggestions.length).toBeGreaterThan(0);
  });

  it('leaves Network Security to the backend when the course is live', () => {
    const ws = store(true);
    expect(ws.dashboard().offerings.map(o => o.offeringId)).toEqual(['off-cs304']);
    expect(ws.knows('off-cs304')).toBeTrue();
    expect(ws.knows(ws.offering('off-cs304').progress.cycles[0].assessmentId)).toBeTrue();
    expect(ws.knows('6f0c1d2e3a4b5c6d7e8f9a0b')).toBeFalse();
  });
});
