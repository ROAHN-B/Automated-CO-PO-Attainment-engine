import { DatePipe, NgClass, NgTemplateOutlet, PercentPipe } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, of, switchMap, tap } from 'rxjs';
import {
  Cam, CamCourseOutcome, CamItem, CamProgramOutcome, CamSuggestion, CamValueSource, UnitCoSuggestion,
} from '../../../../core/models/cam.model';
import { CorrelationLevel, OutcomeKind } from '../../../../core/models/faculty-workspace.model';
import { FacultyWorkspaceService, WorkspaceError } from '../../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../../shared/ui/icon.component';
import { CourseContext } from '../course-context';
import { CamDraft, ItemKind } from './cam-draft';
import {
  nextCodeNumber, parseCourseOutcomes, parseItems, parseObjectives, parseProgramOutcomes, parseUnits, pastedLines,
} from './cam-paste';

type Part = 'inputs' | 'units' | 'matrix' | 'finalize';
type Busy = 'save' | 'suggestUnits' | 'confirm' | 'suggestCells' | 'finalize' | null;
type PasteTarget = 'objectives' | 'cos' | 'units' | 'pos' | 'psos' | ItemKind;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Course articulation matrix (API_CONTRACT §9): faculty-entered course inputs
 * → stage 1 unit → CO links (AI suggests, faculty confirms) → stage 2 CO →
 * PO/PSO levels (AI suggests with evidence, faculty decides every cell) →
 * finalize. The server enforces the stage order; this screen shows it.
 */
@Component({
  selector: 'app-cam-editor',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, DatePipe, PercentPipe, RouterLink, IconComponent],
  templateUrl: './cam-editor.component.html',
})
export class CamEditorComponent {
  private readonly api = inject(FacultyWorkspaceService);
  readonly ctx = inject(CourseContext);
  private readonly destroyRef = inject(DestroyRef);

  readonly draft = new CamDraft();
  readonly cam = signal<Cam | null>(null);
  readonly loadError = signal<WorkspaceError | null>(null);
  readonly actionError = signal<WorkspaceError | null>(null);
  readonly notice = signal('');
  readonly busy = signal<Busy>(null);
  readonly part = signal<Part>('inputs');
  readonly selected = signal<{ coId: string; outcomeId: string } | null>(null);
  readonly hoveredSuggestion = signal<string | null>(null);
  readonly confirmingFinalize = signal(false);
  readonly pasteFor = signal<PasteTarget | null>(null);
  readonly pasteText = signal('');

  readonly levels: (CorrelationLevel | null)[] = [null, 1, 2, 3];
  readonly itemKinds: { kind: ItemKind; title: string; singular: string; example: string }[] = [
    { kind: 'activities', title: 'Activities', singular: 'activity', example: 'Mini project 1 — Classical cryptography toolkit' },
    { kind: 'practicals', title: 'Practicals', singular: 'practical', example: 'RSA key generation and SSH configuration' },
    { kind: 'tutorials', title: 'Tutorials', singular: 'tutorial', example: 'Tutorial 1 — Cipher exercises' },
  ];
  readonly pastePlaceholders: Partial<Record<PasteTarget, string>> = {
    objectives: 'Introduce fundamental principles of network security…\nIntroduce block ciphers and public-key cryptography…',
    cos: 'CO1: Explain the fundamental principles of network security…\nCO2: Illustrate the design and working of block ciphers…',
    units: 'Unit I: Security Fundamentals (8 hours): OSI security architecture; classical ciphers…\nUnit II: Block Ciphers and DES (7 hours): Feistel structure; DES; RSA…',
    pos: 'PO1 Engineering knowledge: Apply knowledge of mathematics, science…\nPO2 Problem analysis: Identify, formulate and analyze…',
    psos: 'PSO1 Algorithms: Develop, realize and validate algorithms…',
  };

  readonly readOnly = computed(() => this.cam()?.status === 'FINALIZED');
  readonly mappingConfirmed = computed(() => this.cam()?.unitMapping.status === 'CONFIRMED');
  readonly cos = this.draft.mappableCos;
  readonly units = computed(() => [...this.draft.inputs().units].sort((a, b) => a.unitNumber - b.unitNumber));
  readonly pos = computed(() => this.draft.mappableOutcomes().filter(o => o.kind === 'PO'));
  readonly psos = computed(() => this.draft.mappableOutcomes().filter(o => o.kind === 'PSO'));
  readonly outcomes = computed(() => [...this.pos(), ...this.psos()]);
  /** The PSO block starts with a divider. */
  readonly firstPsoId = computed(() => this.psos()[0]?.outcomeId ?? null);

  /** Duplicate codes and unit numbers, marked before the server refuses the save. */
  readonly duplicates = computed(() => {
    const i = this.draft.inputs();
    const dupes = (keys: string[]) => new Set(keys.filter((k, n) => k && keys.indexOf(k) !== n));
    return {
      cos: dupes(i.courseOutcomes.map(c => c.code.trim().toUpperCase())),
      units: dupes(i.units.map(u => String(u.unitNumber))),
      outcomes: dupes(i.programOutcomes.map(o => o.code.trim().toUpperCase())),
    };
  });

  /** Presentation hints only; the server decides (422 PRECONDITION_FAILED). */
  readonly unlinkedCos = computed(() => this.cos().filter(co => !this.draft.links().some(l => l.coId === co.coId)));
  readonly cosWithoutOutcome = computed(() => this.cos().filter(co => !this.draft.cells().some(c => c.coId === co.coId)));
  readonly flaggedUnitCount = computed(() => this.draft.unitSuggestions().filter(s => s.needsReview).length);
  readonly flaggedCellCount = computed(() => this.draft.cellSuggestions().filter(s => s.needsReview).length);
  /** Link or CO/unit changes after confirmation return the mapping to draft on save (§9.4). */
  readonly mappingWillReset = computed(() => {
    const cam = this.cam();
    if (!cam || cam.unitMapping.status !== 'CONFIRMED') return false;
    const key = (l: { unitNumber: number; coId: string }) => `${l.unitNumber}|${l.coId}`;
    const evidence = (cos: CamCourseOutcome[], units: unknown) => JSON.stringify([cos, units]);
    const i = this.draft.inputs();
    return cam.unitMapping.links.map(key).sort().join() !== this.draft.links().map(key).sort().join()
      || evidence(cam.inputs.courseOutcomes, cam.inputs.units) !== evidence(i.courseOutcomes, i.units);
  });

  readonly selectedCo = computed(() => this.co(this.selected()?.coId ?? ''));
  readonly selectedOutcome = computed(() => this.outcome(this.selected()?.outcomeId ?? ''));
  readonly selectedCell = computed(() => {
    const s = this.selected();
    return s ? this.draft.cell(s.coId, s.outcomeId) ?? null : null;
  });
  readonly selectedSuggestion = computed(() => {
    const s = this.selected();
    return s ? this.draft.cellSuggestion(s.coId, s.outcomeId) ?? null : null;
  });

  readonly parts = computed(() => {
    const i = this.draft.inputs();
    return [
      { key: 'inputs' as Part, label: 'Course inputs', meta: `${i.courseOutcomes.length} COs · ${i.units.length} units · ${i.programOutcomes.length} POs/PSOs` },
      { key: 'units' as Part, label: 'Unit → CO', meta: this.mappingConfirmed() ? 'Confirmed' : `${this.draft.links().length} links · draft` },
      { key: 'matrix' as Part, label: 'CO → PO/PSO', meta: !this.mappingConfirmed() ? 'Locked' : `${this.draft.cells().length} cells set` },
      { key: 'finalize' as Part, label: 'Finalize', meta: this.cam()?.status === 'FINALIZED' ? 'Finalized' : 'Draft' },
    ];
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loadError.set(null);
    this.api.cam(this.ctx.offeringId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: cam => {
        this.cam.set(cam);
        this.draft.reset(cam);
        this.part.set(this.firstOpenPart(cam));
      },
      error: (e: WorkspaceError) => this.loadError.set(e),
    });
  }

  go(part: Part): void {
    this.part.set(part);
    this.actionError.set(null);
  }

  /* ------------------------------- actions -------------------------------- */

  save(): void {
    this.run('save', this.saveIfDirty(), cam => this.notice.set(`Draft saved · version ${cam.version}`));
  }

  discardChanges(): void {
    const cam = this.cam();
    if (cam) this.draft.reset(cam, true);
  }

  suggestUnits(): void {
    this.run('suggestUnits', this.saveIfDirty().pipe(switchMap(() => this.api.suggestUnitLinks(this.ctx.offeringId()))), set => {
      this.draft.setUnitSuggestions(set.suggestions);
      const n = this.draft.unitSuggestions().length;
      this.notice.set(n ? `${n} suggested links to review` : 'The AI has nothing to add to your links');
    });
  }

  acceptAllUnits(): void {
    const n = this.draft.acceptAllUnitSuggestions();
    this.notice.set(`${n} links accepted. Save or confirm to keep them.`);
  }

  confirmMapping(): void {
    this.run('confirm',
      this.saveIfDirty().pipe(switchMap(cam => this.api.confirmUnitMapping(this.ctx.offeringId(), cam.version))),
      cam => {
        this.cam.set(cam);
        this.draft.reset(cam, true);
        this.notice.set('Mapping confirmed. PO/PSO suggestions are open.');
      });
  }

  suggestCells(): void {
    this.run('suggestCells', this.saveIfDirty().pipe(switchMap(() => this.api.suggestCells(this.ctx.offeringId()))), set => {
      this.draft.setCellSuggestions(set.suggestions);
      const n = this.draft.cellSuggestions().length;
      this.notice.set(n ? `${n} suggested levels to review` : 'The suggestions match what you already set');
    });
  }

  acceptAllCells(): void {
    const n = this.draft.acceptAllCellSuggestions();
    this.notice.set(`${n} empty cells filled from suggestions. Save to keep them.`);
  }

  finalize(): void {
    this.run('finalize',
      this.saveIfDirty().pipe(switchMap(cam => this.api.finalizeCam(this.ctx.offeringId(), cam.version))),
      cam => {
        this.cam.set(cam);
        this.draft.reset(cam);
        this.confirmingFinalize.set(false);
        this.ctx.refresh();
      },
      () => this.confirmingFinalize.set(false));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmingFinalize() && this.busy() !== 'finalize') this.confirmingFinalize.set(false);
  }

  /* ------------------------------ step 1: paste ------------------------------ */

  openPaste(target: PasteTarget): void {
    this.pasteFor.set(this.pasteFor() === target ? null : target);
    this.pasteText.set('');
  }

  placeholderFor(target: PasteTarget): string {
    return this.pastePlaceholders[target] ?? this.itemKinds.find(k => k.kind === target)?.example ?? 'One entry per line';
  }

  pasteCount(): number {
    return pastedLines(this.pasteText()).length;
  }

  applyPaste(): void {
    const text = this.pasteText();
    const target = this.pasteFor();
    const i = this.draft.inputs();
    switch (target) {
      case 'objectives': this.draft.addObjectives(parseObjectives(text)); break;
      case 'cos': this.draft.addCourseOutcomes(parseCourseOutcomes(text, i.courseOutcomes.map(c => c.code))); break;
      case 'units': this.draft.addUnits(parseUnits(text, this.draft.nextUnitNumber())); break;
      case 'pos': this.draft.addProgramOutcomes(parseProgramOutcomes(text, 'PO', i.programOutcomes.map(o => o.code))); break;
      case 'psos': this.draft.addProgramOutcomes(parseProgramOutcomes(text, 'PSO', i.programOutcomes.map(o => o.code))); break;
      case null: return;
      default: this.draft.addItems(target, parseItems(text));
    }
    this.pasteFor.set(null);
    this.pasteText.set('');
  }

  addCo(): void {
    const n = nextCodeNumber(this.draft.inputs().courseOutcomes.map(c => c.code), 'CO');
    this.draft.addCourseOutcomes([{ code: `CO${n}`, statement: '' }]);
  }

  addUnit(): void {
    this.draft.addUnits([{ unitNumber: this.draft.nextUnitNumber(), title: '', content: '' }]);
  }

  addOutcome(kind: OutcomeKind): void {
    const n = nextCodeNumber(this.draft.inputs().programOutcomes.map(o => o.code), kind);
    this.draft.addProgramOutcomes([{ kind, code: `${kind}${n}`, statement: '' }]);
  }

  addItem(kind: ItemKind): void {
    this.draft.addItems(kind, [{ title: '', coIds: [] }]);
  }

  /** Index into `inputs.programOutcomes` for an outcome shown in the PO or PSO list. */
  outcomeIndex(o: CamProgramOutcome): number {
    return this.draft.inputs().programOutcomes.indexOf(o);
  }

  outcomesOf(kind: OutcomeKind): CamProgramOutcome[] {
    return this.draft.inputs().programOutcomes.filter(o => o.kind === kind);
  }

  number(value: string): number | undefined {
    const n = Number(value);
    return value.trim() !== '' && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  }

  /* --------------------------- matrix selection --------------------------- */

  select(coId: string, outcomeId: string): void {
    const s = this.selected();
    this.selected.set(s?.coId === coId && s.outcomeId === outcomeId ? null : { coId, outcomeId });
  }

  pick(level: CorrelationLevel | null): void {
    const s = this.selected();
    if (s && !this.readOnly()) this.draft.setLevel(s.coId, s.outcomeId, level);
  }

  /** Jump to the next undecided suggestion, flagged ones first. */
  nextSuggestion(): void {
    const list = this.draft.cellSuggestions();
    const next = list.find(s => s.needsReview) ?? list[0];
    if (next) this.selected.set({ coId: next.coId, outcomeId: next.outcomeId });
  }

  /* ------------------------------ lookups --------------------------------- */

  co(coId: string): CamCourseOutcome | undefined {
    return this.draft.inputs().courseOutcomes.find(c => c.coId === coId);
  }

  outcome(outcomeId: string): CamProgramOutcome | undefined {
    return this.draft.inputs().programOutcomes.find(o => o.outcomeId === outcomeId);
  }

  roman(n: number): string {
    return ROMAN[n - 1] ?? String(n);
  }

  itemTitle(itemId: string): string {
    const all = this.draft.inputs();
    for (const k of this.itemKinds) {
      const i = all[k.kind].findIndex(x => x.itemId === itemId);
      if (i >= 0) return `${k.singular[0].toUpperCase()}${k.singular.slice(1)} ${i + 1}`;
    }
    return 'Item';
  }

  unitsFor(s: CamSuggestion): string {
    return s.evidence.unitNumbers.map(n => `Unit ${this.roman(n)}`).join(', ');
  }

  itemsFor(s: CamSuggestion): string {
    return s.evidence.itemIds.map(id => this.itemTitle(id)).join(', ');
  }

  sourceLabel(source: CamValueSource): string {
    return source === 'FACULTY' ? 'Set by you' : source === 'AI_ACCEPTED' ? 'AI suggestion, accepted' : 'AI suggestion, edited by you';
  }

  /** Decided levels use the workbook's bronze scale; open suggestions stay dashed until decided. */
  cellClass(level: CorrelationLevel | null, s: CamSuggestion | undefined): string {
    if (level === 1) return 'bg-brand-50 text-brand-700';
    if (level === 2) return 'bg-brand-100 text-brand-800';
    if (level === 3) return 'bg-brand text-white';
    if (s?.needsReview) return 'border border-dashed border-partial bg-surface text-partial';
    if (s) return 'border border-dashed border-brand-300 bg-surface text-brand-700';
    return 'border border-transparent text-ink-faint hover:border-line hover:text-ink-muted';
  }

  linkedCount(coId: string): number {
    return this.draft.links().filter(l => l.coId === coId).length;
  }

  isHovered(s: UnitCoSuggestion | undefined): boolean {
    return !!s && this.hoveredSuggestion() === s.suggestionId;
  }

  trackItem(index: number, item: CamItem): string {
    return item.itemId ?? `new-${index}`;
  }

  /* ------------------------------ plumbing -------------------------------- */

  private saveIfDirty(): Observable<Cam> {
    const cam = this.cam()!;
    if (!this.draft.dirty()) return of(cam);
    return this.api.saveCam(this.ctx.offeringId(), this.draft.toUpdate(cam.version)).pipe(
      tap(saved => {
        this.cam.set(saved);
        this.draft.reset(saved, true);
      }),
    );
  }

  private run<T>(kind: Busy, source$: Observable<T>, done: (v: T) => void, failed?: () => void): void {
    if (this.busy()) return;
    this.busy.set(kind);
    this.actionError.set(null);
    this.notice.set('');
    source$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: v => { this.busy.set(null); done(v); },
      error: (e: WorkspaceError) => { this.busy.set(null); this.actionError.set(e); failed?.(); },
    });
  }

  private firstOpenPart(cam: Cam): Part {
    if (cam.status === 'FINALIZED') return 'matrix';
    const i = cam.inputs;
    if (!i.courseOutcomes.length || !i.units.length || !i.programOutcomes.length) return 'inputs';
    if (cam.unitMapping.status !== 'CONFIRMED') return cam.unitMapping.links.length ? 'units' : 'inputs';
    return cam.cells.length ? 'finalize' : 'matrix';
  }
}
