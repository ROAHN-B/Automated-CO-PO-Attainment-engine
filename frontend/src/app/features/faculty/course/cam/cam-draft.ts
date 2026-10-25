import { computed, signal } from '@angular/core';
import {
  Cam, CamCell, CamCourseOutcome, CamInputs, CamItem, CamProgramOutcome, CamSuggestion, CamUnit, CamUpdate,
  UnitCoLink, UnitCoSuggestion,
} from '../../../../core/models/cam.model';
import { CorrelationLevel, OutcomeKind } from '../../../../core/models/faculty-workspace.model';

export type ItemKind = 'activities' | 'practicals' | 'tutorials';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const pairKey = (unitNumber: number, coId: string) => `${unitNumber}|${coId}`;
const cellKey = (coId: string, outcomeId: string) => `${coId}|${outcomeId}`;
const EMPTY_INPUTS: CamInputs = {
  courseObjectives: [], courseOutcomes: [], units: [], programOutcomes: [], activities: [], practicals: [], tutorials: [],
};

/**
 * The faculty's unsaved edits to a CAM, plus the AI suggestions they haven't
 * decided on yet. Suggestions never land in the draft on their own: only an
 * explicit accept (or a click on that cell) turns one into a value, tagged
 * AI_ACCEPTED or AI_EDITED (API_CONTRACT §9.4).
 */
export class CamDraft {
  readonly inputs = signal<CamInputs>(clone(EMPTY_INPUTS));
  readonly links = signal<UnitCoLink[]>([]);
  readonly cells = signal<CamCell[]>([]);

  /** Undecided suggestions only; accepted or rejected ones are removed. */
  readonly unitSuggestions = signal<UnitCoSuggestion[]>([]);
  readonly cellSuggestions = signal<CamSuggestion[]>([]);

  /** COs and outcomes the server has given an ID; only these can be mapped. */
  readonly mappableCos = computed(() =>
    this.inputs().courseOutcomes.filter((c): c is CamCourseOutcome & { coId: string } => !!c.coId));
  readonly mappableOutcomes = computed(() =>
    this.inputs().programOutcomes.filter((o): o is CamProgramOutcome & { outcomeId: string } => !!o.outcomeId));
  readonly unsavedEntries = computed(() =>
    this.inputs().courseOutcomes.some(c => !c.coId) || this.inputs().programOutcomes.some(o => !o.outcomeId));

  private readonly linkSet = computed(() => new Set(this.links().map(l => pairKey(l.unitNumber, l.coId))));
  private readonly cellMap = computed(() => new Map(this.cells().map(c => [cellKey(c.coId, c.outcomeId), c])));
  private readonly unitSuggestionMap = computed(() =>
    new Map(this.unitSuggestions().map(s => [pairKey(s.unitNumber, s.coId), s])));
  private readonly cellSuggestionMap = computed(() =>
    new Map(this.cellSuggestions().map(s => [cellKey(s.coId, s.outcomeId), s])));

  /** The saved CAM as an update body, to tell whether anything changed. */
  private readonly baseline = signal('');
  readonly dirty = computed(() => this.baseline() !== '' && JSON.stringify(this.toUpdate(0)) !== this.baseline());

  /** Take the server's copy as the new baseline. Pending suggestions survive a save. */
  reset(cam: Cam, keepSuggestions = false): void {
    this.inputs.set(clone(cam.inputs));
    this.links.set(clone(cam.unitMapping.links));
    this.cells.set(clone(cam.cells));
    if (keepSuggestions) {
      this.unitSuggestions.update(list => list.filter(s => !this.linkSet().has(pairKey(s.unitNumber, s.coId))));
    } else {
      this.unitSuggestions.set([]);
      this.cellSuggestions.set([]);
    }
    this.baseline.set(JSON.stringify(CamDraft.build(cam.inputs, cam.unitMapping.links, cam.cells, 0)));
  }

  /* ------------------------------ step 1: inputs ------------------------------ */

  setObjective(index: number, text: string): void {
    this.inputs.update(i => ({ ...i, courseObjectives: i.courseObjectives.map((o, n) => (n === index ? text : o)) }));
  }

  addObjectives(lines: string[]): void {
    this.inputs.update(i => ({ ...i, courseObjectives: [...i.courseObjectives, ...lines] }));
  }

  removeObjective(index: number): void {
    this.inputs.update(i => ({ ...i, courseObjectives: i.courseObjectives.filter((_, n) => n !== index) }));
  }

  addCourseOutcomes(cos: CamCourseOutcome[]): void {
    this.inputs.update(i => ({ ...i, courseOutcomes: [...i.courseOutcomes, ...cos] }));
  }

  patchCourseOutcome(index: number, patch: Partial<CamCourseOutcome>): void {
    this.inputs.update(i => ({ ...i, courseOutcomes: i.courseOutcomes.map((c, n) => (n === index ? { ...c, ...patch } : c)) }));
  }

  /** Removing a CO also drops its links, cells, item links and pending suggestions (§9.4). */
  removeCourseOutcome(index: number): void {
    const id = this.inputs().courseOutcomes[index]?.coId;
    this.inputs.update(i => {
      const strip = (items: CamItem[]) => items.map(it => ({ ...it, coIds: it.coIds.filter(c => c !== id) }));
      return {
        ...i, courseOutcomes: i.courseOutcomes.filter((_, n) => n !== index),
        activities: strip(i.activities), practicals: strip(i.practicals), tutorials: strip(i.tutorials),
      };
    });
    if (!id) return;
    this.links.update(ls => ls.filter(l => l.coId !== id));
    this.cells.update(cs => cs.filter(c => c.coId !== id));
    this.unitSuggestions.update(ss => ss.filter(s => s.coId !== id));
    this.cellSuggestions.update(ss => ss.filter(s => s.coId !== id));
  }

  nextUnitNumber(): number {
    return Math.max(0, ...this.inputs().units.map(u => u.unitNumber || 0)) + 1;
  }

  addUnits(units: CamUnit[]): void {
    this.inputs.update(i => ({ ...i, units: [...i.units, ...units] }));
  }

  /** Renumbering a unit carries its links with it. */
  patchUnit(index: number, patch: Partial<CamUnit>): void {
    const before = this.inputs().units[index];
    this.inputs.update(i => ({ ...i, units: i.units.map((u, n) => (n === index ? { ...u, ...patch } : u)) }));
    if (before && patch.unitNumber !== undefined && patch.unitNumber !== before.unitNumber) {
      this.links.update(ls => ls.map(l => (l.unitNumber === before.unitNumber ? { ...l, unitNumber: patch.unitNumber! } : l)));
      this.unitSuggestions.update(ss => ss.filter(s => s.unitNumber !== before.unitNumber));
    }
  }

  removeUnit(index: number): void {
    const unit = this.inputs().units[index];
    this.inputs.update(i => ({ ...i, units: i.units.filter((_, n) => n !== index) }));
    if (!unit) return;
    this.links.update(ls => ls.filter(l => l.unitNumber !== unit.unitNumber));
    this.unitSuggestions.update(ss => ss.filter(s => s.unitNumber !== unit.unitNumber));
  }

  /** Keeps POs before PSOs, each in the order entered. */
  addProgramOutcomes(outcomes: CamProgramOutcome[]): void {
    this.inputs.update(i => {
      const all = [...i.programOutcomes, ...outcomes];
      return { ...i, programOutcomes: [...all.filter(o => o.kind === 'PO'), ...all.filter(o => o.kind === 'PSO')] };
    });
  }

  patchProgramOutcome(index: number, patch: Partial<CamProgramOutcome>): void {
    this.inputs.update(i => ({ ...i, programOutcomes: i.programOutcomes.map((o, n) => (n === index ? { ...o, ...patch } : o)) }));
  }

  removeProgramOutcome(index: number): void {
    const id = this.inputs().programOutcomes[index]?.outcomeId;
    this.inputs.update(i => ({ ...i, programOutcomes: i.programOutcomes.filter((_, n) => n !== index) }));
    if (!id) return;
    this.cells.update(cs => cs.filter(c => c.outcomeId !== id));
    this.cellSuggestions.update(ss => ss.filter(s => s.outcomeId !== id));
  }

  outcomeCount(kind: OutcomeKind): number {
    return this.inputs().programOutcomes.filter(o => o.kind === kind).length;
  }

  addItems(kind: ItemKind, items: CamItem[]): void {
    this.inputs.update(i => ({ ...i, [kind]: [...i[kind], ...items] }));
  }

  removeItem(kind: ItemKind, index: number): void {
    this.inputs.update(i => ({ ...i, [kind]: i[kind].filter((_, n) => n !== index) }));
  }

  patchItem(kind: ItemKind, index: number, patch: Partial<CamItem>): void {
    this.inputs.update(i => ({ ...i, [kind]: i[kind].map((it, n) => (n === index ? { ...it, ...patch } : it)) }));
  }

  toggleItemCo(kind: ItemKind, index: number, coId: string): void {
    const it = this.inputs()[kind][index];
    const coIds = it.coIds.includes(coId) ? it.coIds.filter(c => c !== coId) : [...it.coIds, coId];
    this.patchItem(kind, index, { coIds });
  }

  /* ---------------------------- step 2: units → COs --------------------------- */

  isLinked(unitNumber: number, coId: string): boolean {
    return this.linkSet().has(pairKey(unitNumber, coId));
  }

  link(unitNumber: number, coId: string): UnitCoLink | undefined {
    return this.links().find(l => l.unitNumber === unitNumber && l.coId === coId);
  }

  unitSuggestion(unitNumber: number, coId: string): UnitCoSuggestion | undefined {
    return this.unitSuggestionMap().get(pairKey(unitNumber, coId));
  }

  /** A click on a grid cell. Linking a suggested pair accepts that suggestion. */
  toggleLink(unitNumber: number, coId: string): void {
    const pending = this.unitSuggestion(unitNumber, coId);
    if (pending) { this.acceptUnitSuggestion(pending); return; }
    if (this.isLinked(unitNumber, coId)) {
      this.links.update(ls => ls.filter(l => !(l.unitNumber === unitNumber && l.coId === coId)));
    } else {
      this.links.update(ls => [...ls, { unitNumber, coId, source: 'FACULTY' }]);
    }
  }

  setUnitSuggestions(suggestions: UnitCoSuggestion[]): void {
    // A pair the faculty already linked needs no decision.
    this.unitSuggestions.set(suggestions.filter(s => !this.isLinked(s.unitNumber, s.coId)));
  }

  acceptUnitSuggestion(s: UnitCoSuggestion): void {
    if (!this.isLinked(s.unitNumber, s.coId)) {
      this.links.update(ls => [...ls, { unitNumber: s.unitNumber, coId: s.coId, source: 'AI_ACCEPTED', suggestionId: s.suggestionId }]);
    }
    this.unitSuggestions.update(list => list.filter(x => x.suggestionId !== s.suggestionId));
  }

  rejectUnitSuggestion(s: UnitCoSuggestion): void {
    this.unitSuggestions.update(list => list.filter(x => x.suggestionId !== s.suggestionId));
  }

  /** "Accept all" never includes flagged suggestions; those are decided one by one. */
  acceptAllUnitSuggestions(): number {
    const take = this.unitSuggestions().filter(s => !s.needsReview);
    take.forEach(s => this.acceptUnitSuggestion(s));
    return take.length;
  }

  /* ---------------------------- step 3: CO → PO/PSO --------------------------- */

  cell(coId: string, outcomeId: string): CamCell | undefined {
    return this.cellMap().get(cellKey(coId, outcomeId));
  }

  cellSuggestion(coId: string, outcomeId: string): CamSuggestion | undefined {
    return this.cellSuggestionMap().get(cellKey(coId, outcomeId));
  }

  /** The faculty picks a level (null = blank). If a suggestion was pending, it is decided by this pick. */
  setLevel(coId: string, outcomeId: string, level: CorrelationLevel | null): void {
    const pending = this.cellSuggestion(coId, outcomeId);
    const current = this.cell(coId, outcomeId);
    let next: CamCell | null = null;
    if (level !== null) {
      if (pending) {
        next = {
          coId, outcomeId, level, justification: current?.justification ?? pending.rationale,
          source: level === pending.suggestedLevel ? 'AI_ACCEPTED' : 'AI_EDITED', suggestionId: pending.suggestionId,
        };
      } else if (current && current.source !== 'FACULTY') {
        next = { ...current, level, source: 'AI_EDITED' };
      } else {
        next = { coId, outcomeId, level, justification: current?.justification, source: 'FACULTY' };
      }
    }
    this.cells.update(cs => {
      const rest = cs.filter(c => !(c.coId === coId && c.outcomeId === outcomeId));
      return next ? [...rest, next] : rest;
    });
    if (pending) this.cellSuggestions.update(list => list.filter(x => x.suggestionId !== pending.suggestionId));
  }

  setJustification(coId: string, outcomeId: string, text: string): void {
    this.cells.update(cs => cs.map(c => (c.coId === coId && c.outcomeId === outcomeId ? { ...c, justification: text || undefined } : c)));
  }

  setCellSuggestions(suggestions: CamSuggestion[]): void {
    // A suggestion that matches what the faculty already set needs no decision.
    this.cellSuggestions.set(suggestions.filter(s => (this.cell(s.coId, s.outcomeId)?.level ?? null) !== s.suggestedLevel));
  }

  acceptCellSuggestion(s: CamSuggestion): void {
    this.setLevel(s.coId, s.outcomeId, s.suggestedLevel);
  }

  rejectCellSuggestion(s: CamSuggestion): void {
    this.cellSuggestions.update(list => list.filter(x => x.suggestionId !== s.suggestionId));
  }

  /** Fills only empty cells, and never with a flagged suggestion. */
  acceptAllCellSuggestions(): number {
    const take = this.cellSuggestions().filter(s => !s.needsReview && !this.cell(s.coId, s.outcomeId));
    take.forEach(s => this.acceptCellSuggestion(s));
    return take.length;
  }

  readonly acceptableCellCount = computed(() =>
    this.cellSuggestions().filter(s => !s.needsReview && !this.cellMap().has(cellKey(s.coId, s.outcomeId))).length);

  /* ---------------------------------- output ---------------------------------- */

  toUpdate(version: number): CamUpdate {
    return CamDraft.build(this.inputs(), this.links(), this.cells(), version);
  }

  private static build(inputs: CamInputs, links: UnitCoLink[], cells: CamCell[], version: number): CamUpdate {
    return {
      version,
      inputs,
      unitLinks: [...links].sort((a, b) => a.unitNumber - b.unitNumber || a.coId.localeCompare(b.coId)),
      cells: [...cells].sort((a, b) => a.coId.localeCompare(b.coId) || a.outcomeId.localeCompare(b.outcomeId)),
    };
  }
}
