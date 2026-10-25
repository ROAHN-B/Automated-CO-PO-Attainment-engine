import { CamMockStore, networkSecurityCam } from '../../../../core/mocks/cam.mock';
import { FacultyWorkspaceMockStore } from '../../../../core/mocks/faculty-workspace.mock';
import { CamUpdate } from '../../../../core/models/cam.model';
import { CamDraft } from './cam-draft';
import { parseCourseOutcomes, parseItems, parseProgramOutcomes, parseUnits } from './cam-paste';

const links = [1, 2, 3, 4].map(n => ({ unitNumber: n, coId: `co-ns-${n}`, source: 'FACULTY' as const }));

/** A save body that keeps the seeded inputs and sets only links and cells. */
function update(store: CamMockStore, id: string, patch: Partial<CamUpdate>): CamUpdate {
  const cam = store.cam(id);
  return { version: cam.version, inputs: cam.inputs, unitLinks: cam.unitMapping.links, cells: cam.cells, ...patch };
}

describe('CamDraft (API_CONTRACT v2.4 §9.4)', () => {
  const fresh = () => {
    const store = new CamMockStore([networkSecurityCam('off-ns')], () => {});
    const draft = new CamDraft();
    draft.reset(store.cam('off-ns'));
    return { store, draft };
  };
  const confirmed = () => {
    const { store, draft } = fresh();
    draft.setUnitSuggestions(store.suggestUnits('off-ns').suggestions);
    draft.unitSuggestions().forEach(s => draft.acceptUnitSuggestion(s));
    const saved = store.save('off-ns', draft.toUpdate(store.cam('off-ns').version));
    store.confirmUnits('off-ns', saved.version);
    draft.reset(store.cam('off-ns'));
    return { store, draft };
  };

  it('starts clean and becomes dirty on an edit', () => {
    const { draft } = fresh();
    expect(draft.dirty()).toBeFalse();
    draft.toggleLink(1, 'co-ns-1');
    expect(draft.dirty()).toBeTrue();
    draft.toggleLink(1, 'co-ns-1');
    expect(draft.dirty()).toBeFalse();
    draft.setObjective(0, 'Changed');
    expect(draft.dirty()).toBeTrue();
  });

  it('never applies a suggestion until the faculty accepts it', () => {
    const { store, draft } = fresh();
    draft.setUnitSuggestions(store.suggestUnits('off-ns').suggestions);
    expect(draft.unitSuggestions().length).toBe(9);
    expect(draft.links().length).toBe(0);
  });

  it('leaves flagged unit suggestions out of "accept all"', () => {
    const { store, draft } = fresh();
    draft.setUnitSuggestions(store.suggestUnits('off-ns').suggestions);
    expect(draft.acceptAllUnitSuggestions()).toBe(8);
    expect(draft.unitSuggestions().map(s => `${s.unitNumber}|${s.coId}`)).toEqual(['5|co-ns-4']);
    expect(draft.links().every(l => l.source === 'AI_ACCEPTED' && !!l.suggestionId)).toBeTrue();
  });

  it('tags a cell AI_EDITED when the faculty picks a different level than suggested', () => {
    const { store, draft } = confirmed();
    draft.setCellSuggestions(store.suggestCells('off-ns').suggestions);
    const po1 = draft.cellSuggestion('co-ns-1', 'out-po1')!;
    draft.setLevel('co-ns-1', 'out-po1', 2);
    const cell = draft.cell('co-ns-1', 'out-po1')!;
    expect(cell.source).toBe('AI_EDITED');
    expect(cell.suggestionId).toBe(po1.suggestionId);
    expect(draft.cellSuggestion('co-ns-1', 'out-po1')).toBeUndefined();
  });

  it('fills only empty cells, never flagged ones, and never overwrites a faculty value', () => {
    const { store, draft } = confirmed();
    draft.setLevel('co-ns-1', 'out-po1', 1);
    draft.setCellSuggestions(store.suggestCells('off-ns').suggestions);
    expect(draft.acceptAllCellSuggestions()).toBe(21 - 1 - 2);
    expect(draft.cell('co-ns-1', 'out-po1')).toEqual(jasmine.objectContaining({ level: 1, source: 'FACULTY' }));
    expect(draft.cellSuggestions().filter(s => s.needsReview).length).toBe(2);
  });

  it('removing a CO drops its links, cells and item links', () => {
    const { draft } = confirmed();
    draft.setLevel('co-ns-4', 'out-po8', 3);
    draft.removeCourseOutcome(3);
    expect(draft.links().some(l => l.coId === 'co-ns-4')).toBeFalse();
    expect(draft.cell('co-ns-4', 'out-po8')).toBeUndefined();
    expect(draft.inputs().activities[1].coIds).toEqual(['co-ns-3']);
  });

  it('renumbering a unit carries its links', () => {
    const { draft } = confirmed();
    draft.patchUnit(0, { unitNumber: 7 });
    expect(draft.isLinked(7, 'co-ns-1')).toBeTrue();
    expect(draft.isLinked(1, 'co-ns-1')).toBeFalse();
  });

  it('only offers saved COs and outcomes for mapping', () => {
    const { draft } = fresh();
    draft.addCourseOutcomes([{ code: 'CO5', statement: 'New outcome' }]);
    expect(draft.mappableCos().length).toBe(4);
    expect(draft.unsavedEntries()).toBeTrue();
  });
});

describe('CamMockStore rules (API_CONTRACT v2.4 §9.4)', () => {
  const store = () => new CamMockStore([networkSecurityCam('off-ns')], () => {});

  it('refuses stage 2 suggestions until the mapping is confirmed', () => {
    expect(() => store().suggestCells('off-ns')).toThrowMatching((e: any) => e.errorCode === 'PRECONDITION_FAILED');
  });

  it('refuses to confirm while a CO has no unit', () => {
    const s = store();
    const saved = s.save('off-ns', update(s, 'off-ns', { unitLinks: [links[0]] }));
    expect(() => s.confirmUnits('off-ns', saved.version)).toThrowMatching((e: any) => e.message.includes('CO2, CO3, CO4'));
  });

  it('returns a confirmed mapping to draft when links or COs change', () => {
    const s = store();
    let cam = s.save('off-ns', update(s, 'off-ns', { unitLinks: links }));
    cam = s.confirmUnits('off-ns', cam.version);
    expect(cam.unitMapping.status).toBe('CONFIRMED');
    const inputs = { ...cam.inputs, courseOutcomes: cam.inputs.courseOutcomes.map((c, i) => (i === 0 ? { ...c, statement: 'Reworded' } : c)) };
    cam = s.save('off-ns', update(s, 'off-ns', { inputs }));
    expect(cam.unitMapping.status).toBe('DRAFT');
  });

  it('assigns IDs to new entries and rejects duplicate codes', () => {
    const s = store();
    const cam = s.cam('off-ns');
    const added = s.save('off-ns', update(s, 'off-ns', {
      inputs: { ...cam.inputs, courseOutcomes: [...cam.inputs.courseOutcomes, { code: 'CO5', statement: 'New' }] },
    }));
    expect(added.inputs.courseOutcomes[4].coId).toBeTruthy();
    expect(() => s.save('off-ns', update(s, 'off-ns', {
      inputs: { ...added.inputs, courseOutcomes: [...added.inputs.courseOutcomes, { code: 'co1', statement: 'Dup' }] },
    }))).toThrowMatching((e: any) => e.errorCode === 'VALIDATION_FAILED');
  });

  it('removing a unit removes its links', () => {
    const s = store();
    const cam = s.save('off-ns', update(s, 'off-ns', { unitLinks: links }));
    const saved = s.save('off-ns', update(s, 'off-ns', { inputs: { ...cam.inputs, units: cam.inputs.units.slice(1) } }));
    expect(saved.unitMapping.links.map(l => l.unitNumber)).toEqual([2, 3, 4]);
  });

  it('finalizes once, then rejects edits and tells the lifecycle', () => {
    let finalized = '';
    const s = new CamMockStore([networkSecurityCam('off-ns')], id => (finalized = id));
    let cam = s.save('off-ns', update(s, 'off-ns', { unitLinks: links }));
    cam = s.confirmUnits('off-ns', cam.version);
    cam = s.finalize('off-ns', cam.version);
    expect(cam.status).toBe('FINALIZED');
    expect(finalized).toBe('off-ns');
    expect(() => s.suggestUnits('off-ns')).toThrowMatching((e: any) => e.errorCode === 'ALREADY_FINALIZED');
  });
});

describe('Finalizing the CAM in the workspace mock', () => {
  it('completes setup and opens only the first cycle', () => {
    const ws = new FacultyWorkspaceMockStore();
    let cam = ws.cams.save('off-ec306', update(ws.cams, 'off-ec306', { unitLinks: links }));
    cam = ws.cams.confirmUnits('off-ec306', cam.version);
    ws.cams.finalize('off-ec306', cam.version);

    const p = ws.offering('off-ec306').progress;
    expect(p.setup.cam.status).toBe('DONE');
    expect(p.cycles[0].steps.paperValidation!.status).toBe('AVAILABLE');
    expect(p.cycles[1].steps.marksheet.status).toBe('LOCKED');
    expect(p.nextAction?.step).toBe('PAPER_VALIDATION');
  });

  it('gives the finalized demo courses units and a confirmed mapping', () => {
    const cam = new FacultyWorkspaceMockStore().cams.cam('off-cs304');
    expect(cam.inputs.units.length).toBe(6);
    expect(cam.inputs.courseOutcomes.every(co => cam.unitMapping.links.some(l => l.coId === co.coId))).toBeTrue();
  });
});

describe('Pasting lists into the CAM inputs', () => {
  it('keeps CO codes and numbers the rest in order', () => {
    expect(parseCourseOutcomes('CO3: Analyze protocols\n• Explain ciphers', ['CO1', 'CO2'])).toEqual([
      { code: 'CO3', statement: 'Analyze protocols' },
      { code: 'CO4', statement: 'Explain ciphers' },
    ]);
    expect(parseCourseOutcomes('Explain ciphers', ['CO1', 'CO6']).map(c => c.code)).toEqual(['CO7']);
  });

  it('reads roman unit numbers, hours and topics', () => {
    expect(parseUnits('Unit IV: Network and Internet Security (6 hours): NAC; EAP; IEEE 802.1X', 1)).toEqual([
      { unitNumber: 4, title: 'Network and Internet Security', content: 'NAC; EAP; IEEE 802.1X', hours: 6 },
    ]);
    expect(parseUnits('Block ciphers\nKey management', 3).map(u => u.unitNumber)).toEqual([3, 4]);
  });

  it('splits PO title from statement and keeps PSO kind', () => {
    expect(parseProgramOutcomes('PO1 Engineering knowledge: Apply knowledge\nPSO2 Systems — Develop systems', 'PO', [])).toEqual([
      { kind: 'PO', code: 'PO1', title: 'Engineering knowledge', statement: 'Apply knowledge' },
      { kind: 'PSO', code: 'PSO2', title: 'Systems', statement: 'Develop systems' },
    ]);
  });

  it('turns numbered lines into items without COs', () => {
    expect(parseItems('1. Pretty Good Privacy\n2. RSA key generation')).toEqual([
      { title: 'Pretty Good Privacy', coIds: [] },
      { title: 'RSA key generation', coIds: [] },
    ]);
  });
});
