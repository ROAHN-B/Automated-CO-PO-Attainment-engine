import { FacultyWorkspaceMockStore } from '../../core/mocks/faculty-workspace.mock';
import { groupStatus, lifecycleGroups, nextActionLink, stepCounts, stepKeyFromParam } from './lifecycle';

describe('faculty lifecycle helpers', () => {
  const store = new FacultyWorkspaceMockStore();
  const os = store.offering('off-cs301');

  it('orders groups as setup → cycles in plan order → close-out', () => {
    const groups = lifecycleGroups(os.progress);
    expect(groups[0].id).toBe('setup');
    expect(groups[groups.length - 1].id).toBe('close-out');
    expect(groups.slice(1, -1).map(g => g.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('only gives exams a paper-validation step', () => {
    const [, ise1, , act1] = lifecycleGroups(os.progress);
    expect(ise1.steps[0].key).toBe('PAPER_VALIDATION');
    expect(act1.steps[0].key).toBe('MARKSHEET');
  });

  it('reports group status from the backend step states', () => {
    const [setup, ise1, ise2, act1] = lifecycleGroups(os.progress);
    expect(groupStatus(setup)).toBe('DONE');
    expect(groupStatus(ise1)).toBe('DONE');
    expect(groupStatus(ise2)).toBe('ACTIVE');
    expect(groupStatus(act1)).toBe('LOCKED');
  });

  it('counts steps without deciding any of them', () => {
    const { done, total } = stepCounts(os.progress);
    expect(total).toBe(34);
    expect(done).toBe(12);
  });

  it('links attainment steps to the calculation page scoped to that assessment', () => {
    expect(nextActionLink(os)).toEqual({ path: ['attainment'], query: { upTo: 'as-os-ise2' } });
  });

  it('parses step keys from the URL safely', () => {
    expect(stepKeyFromParam('marks_approval')).toBe('MARKS_APPROVAL');
    expect(stepKeyFromParam('drop_table')).toBeNull();
    expect(stepKeyFromParam(null)).toBeNull();
  });
});

describe('FacultyWorkspaceMockStore (contract v2.2 flow)', () => {
  it('shows the calculate action only under the block whose marks are approved', () => {
    const store = new FacultyWorkspaceMockStore();
    const blocks = store.workbook('off-cs301').data.blocks;
    expect(blocks.filter(b => b.canCalculate).map(b => b.name)).toEqual(['ISE-2']);
  });

  it('keeps ESE-dependent values pending before any ESE marks (option a)', () => {
    const store = new FacultyWorkspaceMockStore();
    const run = store.calculate('off-cs301', 'as-os-ise2');
    expect(run.status).toBe('CALCULATED');
    for (const co of run.coResults) {
      expect(co.ese).toBeNull();
      expect(co.direct).toBeNull();
      expect(co.overall).toBeNull();
      expect(co.pendingReason).toBe('AWAITING_ESE');
    }
  });

  it('approving writes the run to the workbook and unlocks only the next cycle', () => {
    const store = new FacultyWorkspaceMockStore();
    const run = store.calculate('off-cs301', 'as-os-ise2');
    store.approve(run.runId);

    const p = store.offering('off-cs301').progress;
    expect(p.cycles[1].steps.attainmentApproval.status).toBe('DONE');
    expect(p.cycles[2].steps.marksheet.status).toBe('AVAILABLE');
    expect(p.cycles[3].steps.marksheet.status).toBe('LOCKED');
    expect(store.workbook('off-cs301').asOf).toBe('Cumulative up to ISE-2');
    expect(store.preview('off-cs301')).toBeNull();
  });

  it('refuses to approve a run that was never calculated', () => {
    const store = new FacultyWorkspaceMockStore();
    expect(() => store.approve('run-os-2')).toThrow();
  });

  it('has no workbook until the CAM is finalized', () => {
    const store = new FacultyWorkspaceMockStore();
    expect(() => store.workbook('off-ec305')).toThrow();
  });
});
