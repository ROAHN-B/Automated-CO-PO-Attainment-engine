import { NgClass } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  COMPONENT_CATEGORIES, COMPONENT_KEYS, ComponentKey, CourseGroup, LoadIssue, LoadRow,
} from '../../../core/models/coordination.model';
import { AssessmentCategory } from '../../../core/models/faculty-workspace.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';
import { COLUMN_HELP, COLUMN_LABELS, categoryOption } from './load-helpers';

/**
 * Edit one row of the load distribution: course details, hours, credits, the
 * four mark columns and how each column's marks are earned, elective options,
 * the MOOC alternative and whether it needs a faculty member. The parent saves
 * the whole table (CRD-20); the server returns the row's issues.
 */
@Component({
  selector: 'app-load-row-dialog',
  standalone: true,
  imports: [NgClass, FormsModule, IconComponent, BodyPortalDirective],
  template: `
    <div class="modal-backdrop" appBodyPortal (click)="close()">
      <div class="modal flex max-h-[92vh] max-w-3xl flex-col" role="dialog" aria-modal="true" aria-labelledby="lr-title" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h3 id="lr-title" class="font-serif text-2xl font-light text-ink">{{ isNew() ? 'Add a course' : 'Edit ' + (row.courseCode || 'course') }}</h3>
            <p class="mt-1 text-sm text-ink-soft">One row of the load distribution, as printed in the syllabus.</p>
          </div>
          <button type="button" class="btn btn-ghost btn-icon" (click)="close()" [disabled]="saving()" aria-label="Close">
            <app-icon name="close" class="h-5 w-5" />
          </button>
        </div>

        <div class="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-5">
          @if (issues().length) {
            <div class="alert alert-warning" role="status">
              <app-icon name="alert" class="mt-0.5 h-4 w-4" />
              <div>
                <p class="font-semibold">To fix in this row</p>
                <ul class="mt-1 list-disc pl-4">@for (i of issues(); track $index) { <li>{{ i.message }}</li> }</ul>
              </div>
            </div>
          }

          <!-- Course -->
          <section class="space-y-4" aria-labelledby="lr-course">
            <h4 id="lr-course" class="text-[15px] font-semibold text-ink">Course</h4>
            <fieldset class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
              <legend class="field-label">Section</legend>
              <label class="flex items-center gap-2"><input type="radio" name="lr-section" [(ngModel)]="row.section" value="THEORY" /> Theory courses</label>
              <label class="flex items-center gap-2"><input type="radio" name="lr-section" [(ngModel)]="row.section" value="LABORATORY" /> Laboratory courses</label>
            </fieldset>

            <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div class="field">
                <label class="field-label" for="lr-group">Group</label>
                @if (!addingGroup()) {
                  <div class="flex gap-2">
                    <select id="lr-group" class="field-select flex-1" [(ngModel)]="row.groupCode">
                      @for (g of groupList(); track g.code) { <option [value]="g.code">{{ g.code }} · {{ g.name }}</option> }
                    </select>
                    <button type="button" class="btn btn-ghost btn-sm h-11" (click)="addingGroup.set(true)">New group</button>
                  </div>
                } @else {
                  <div class="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                    <input class="field-input" [(ngModel)]="newGroupCode" placeholder="Code" aria-label="New group code" maxlength="10" />
                    <input class="field-input" [(ngModel)]="newGroupName" placeholder="Name, e.g. Open Elective" aria-label="New group name" />
                  </div>
                  @if (groupError()) { <p class="field-error">{{ groupError() }}</p> }
                  <div class="mt-2 flex gap-2">
                    <button type="button" class="btn btn-outline btn-sm" (click)="addGroup()" [disabled]="groupBusy()">Add group</button>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="addingGroup.set(false)">Cancel</button>
                  </div>
                }
              </div>
              <div class="field">
                <label class="field-label" for="lr-code">Course code</label>
                <input id="lr-code" class="field-input font-mono" [(ngModel)]="row.courseCode" placeholder="23ECU7CC1T" />
                <p class="field-help">As printed; placeholders such as EN*3 are fine for a slot.</p>
              </div>
            </div>
            <div class="field">
              <label class="field-label" for="lr-name">Name of course</label>
              <input id="lr-name" class="field-input" [(ngModel)]="row.courseName" placeholder="Internet of Things (IoT)" />
            </div>
          </section>

          <!-- Hours and credits -->
          <section class="space-y-3" aria-labelledby="lr-hours">
            <h4 id="lr-hours" class="text-[15px] font-semibold text-ink">Engagement hours and credits</h4>
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div class="field"><label class="field-label" for="lr-l">L (lecture)</label><input id="lr-l" type="number" min="0" max="20" step="1" class="field-input tnum" [(ngModel)]="row.hours.lecture" /></div>
              <div class="field"><label class="field-label" for="lr-t">T (tutorial)</label><input id="lr-t" type="number" min="0" max="20" step="1" class="field-input tnum" [(ngModel)]="row.hours.tutorial" /></div>
              <div class="field"><label class="field-label" for="lr-p">P (practical)</label><input id="lr-p" type="number" min="0" max="20" step="1" class="field-input tnum" [(ngModel)]="row.hours.practical" /></div>
              <div class="field"><label class="field-label" for="lr-cr">Credits</label><input id="lr-cr" type="number" min="0" max="20" step="0.5" class="field-input tnum" [(ngModel)]="row.credits" /></div>
            </div>
            <p class="text-xs text-ink-muted">Hours per week. 0 prints as “--”.</p>
          </section>

          <!-- Marks -->
          <section class="space-y-3" aria-labelledby="lr-marks">
            <div>
              <h4 id="lr-marks" class="text-[15px] font-semibold text-ink">Marks</h4>
              <p class="mt-0.5 text-sm text-ink-muted">Leave a column at 0 if the course doesn’t have it: no step, workbook column or report is made for it.</p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              @for (k of keys; track k) { @let c = row.components[k];
                <div class="rounded-lg border p-4" [ngClass]="c.totalMarks ? 'border-line bg-surface' : 'border-line-soft bg-paper-deep/50'">
                  <div class="flex items-end justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-ink">{{ labels[k] }}</p>
                      <p class="text-xs text-ink-muted">{{ help[k] }}</p>
                    </div>
                    <div class="field w-24">
                      <label class="sr-only" [for]="'lr-tot-' + k">{{ labels[k] }} total marks</label>
                      <input [id]="'lr-tot-' + k" type="number" min="0" step="0.5" class="field-input h-10 text-right tnum"
                             [ngModel]="c.totalMarks" (ngModelChange)="setTotal(k, $event)" />
                    </div>
                  </div>

                  @if (c.totalMarks) {
                    @if (k === 'ese') {
                      <p class="mt-3 text-xs text-ink-muted">One end-semester paper of {{ c.totalMarks }} marks.</p>
                    } @else if (k === 'oePoe') {
                      <div class="field mt-3">
                        <label class="field-label text-xs" [for]="'lr-oe'">Exam type</label>
                        <select id="lr-oe" class="field-select h-10" [ngModel]="c.items.length ? c.items[0].category : null" (ngModelChange)="setSingle(k, $event)">
                          @for (cat of categories[k]; track cat) { <option [value]="cat">{{ categoryOption(cat) }}</option> }
                        </select>
                      </div>
                    } @else {
                      <p class="mt-3 text-xs font-semibold text-ink-soft">How the {{ c.totalMarks }} marks are earned</p>
                      <ul class="mt-2 space-y-2">
                        @for (it of c.items; track $index; let i = $index) {
                          <li class="grid grid-cols-[minmax(0,1fr)_64px_72px_32px] items-center gap-2">
                            <select class="field-select h-9 text-[13px]" [(ngModel)]="it.category" [attr.aria-label]="labels[k] + ' item ' + (i + 1) + ' type'">
                              @for (cat of categories[k]; track cat) { <option [value]="cat">{{ categoryOption(cat) }}</option> }
                            </select>
                            <input type="number" min="1" step="1" class="field-input h-9 text-right tnum" [(ngModel)]="it.count" [attr.aria-label]="labels[k] + ' item ' + (i + 1) + ' count'" />
                            <input type="number" min="0.5" step="0.5" class="field-input h-9 text-right tnum" [(ngModel)]="it.maxMarksEach" [attr.aria-label]="labels[k] + ' item ' + (i + 1) + ' marks each'" />
                            <button type="button" class="btn btn-ghost btn-icon h-8 w-8" (click)="removeItem(k, i)" [attr.aria-label]="'Remove ' + labels[k] + ' item ' + (i + 1)">
                              <app-icon name="close" class="h-4 w-4" />
                            </button>
                          </li>
                        }
                      </ul>
                      <div class="mt-1 grid grid-cols-[minmax(0,1fr)_64px_72px_32px] gap-2 text-[11px] text-ink-faint" aria-hidden="true">
                        <span></span><span class="text-right">count</span><span class="text-right">marks each</span><span></span>
                      </div>
                      <div class="mt-2 flex items-center justify-between gap-2">
                        <button type="button" class="btn btn-ghost btn-sm" (click)="addItem(k)"><app-icon name="plus" class="h-3.5 w-3.5" /> Add</button>
                        <!-- A provisional check while editing; the server's issue list is authoritative (§15.4.2). -->
                        <span class="text-xs tnum" [ngClass]="sum(k) === c.totalMarks ? 'text-ink-muted' : 'font-semibold text-gap'">
                          {{ sum(k) === c.totalMarks ? 'Adds up to ' + c.totalMarks : 'Adds up to ' + sum(k) + ', not ' + c.totalMarks }}
                        </span>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          </section>

          <!-- Options, MOOC, faculty -->
          <section class="space-y-4" aria-labelledby="lr-more">
            <h4 id="lr-more" class="text-[15px] font-semibold text-ink">Electives and alternatives</h4>

            <label class="flex items-start gap-2.5 text-sm text-ink">
              <input type="checkbox" class="mt-0.5" [ngModel]="!!row.options" (ngModelChange)="toggleOptions($event)" />
              <span>Students choose this course from a list (an elective or minor slot)
                <span class="block text-xs text-ink-muted">Each option that runs this semester is a separate subject for allocation.</span></span>
            </label>
            @if (row.options) {
              <ul class="space-y-2 pl-6">
                @for (o of row.options; track $index; let j = $index) {
                  <li class="grid grid-cols-1 gap-2 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,0.8fr)_auto_32px] sm:items-center">
                    <input class="field-input h-9 font-mono text-[13px]" [(ngModel)]="o.courseCode" placeholder="Code" [attr.aria-label]="'Option ' + (j + 1) + ' code'" />
                    <input class="field-input h-9 text-[13px]" [(ngModel)]="o.courseName" placeholder="Course name" [attr.aria-label]="'Option ' + (j + 1) + ' name'" />
                    <input class="field-input h-9 text-[13px]" [(ngModel)]="o.offeringDepartment" placeholder="Taught by (other department)" [attr.aria-label]="'Option ' + (j + 1) + ' offering department'" />
                    <label class="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-soft"><input type="checkbox" [(ngModel)]="o.offered" /> Runs</label>
                    <button type="button" class="btn btn-ghost btn-icon h-8 w-8" (click)="row.options!.splice(j, 1)" [attr.aria-label]="'Remove option ' + (j + 1)">
                      <app-icon name="close" class="h-4 w-4" />
                    </button>
                  </li>
                }
                <li><button type="button" class="btn btn-ghost btn-sm" (click)="row.options!.push({ courseCode: '', courseName: '', offered: true })"><app-icon name="plus" class="h-3.5 w-3.5" /> Add option</button></li>
              </ul>
            }

            <label class="flex items-start gap-2.5 text-sm text-ink">
              <input type="checkbox" class="mt-0.5" [ngModel]="!!row.moocAlternative" (ngModelChange)="row.moocAlternative = $event ? { note: '' } : undefined" />
              <span>Can also be earned through a MOOC (“/ MOOC#” in the syllabus)</span>
            </label>
            @if (row.moocAlternative) {
              <div class="field pl-6">
                <label class="sr-only" for="lr-mooc">MOOC note</label>
                <input id="lr-mooc" class="field-input" [(ngModel)]="row.moocAlternative.note" placeholder="Note, e.g. approved MOOCs are announced by the Board of Studies" />
              </div>
            }

            <label class="flex items-start gap-2.5 text-sm text-ink">
              <input type="checkbox" class="mt-0.5" [(ngModel)]="row.needsFaculty" />
              <span>Needs a faculty member from this department
                <span class="block text-xs text-ink-muted">Untick for courses taught by another department or earned only through a MOOC.</span></span>
            </label>
          </section>

          @if (error()) {
            <div class="alert alert-error" role="alert">
              <app-icon name="alert" class="mt-0.5 h-4 w-4" />
              <p>{{ error() }}</p>
            </div>
          }
        </div>

        <div class="flex justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" class="btn btn-ghost" (click)="close()" [disabled]="saving()">Cancel</button>
          <button type="button" class="btn btn-primary" (click)="apply()" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> Saving… } @else { {{ isNew() ? 'Add course' : 'Save course' }} }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class LoadRowDialogComponent implements OnInit {
  private readonly api = inject(CoordinationService);

  readonly initial = input.required<LoadRow>();
  readonly groups = input.required<CourseGroup[]>();
  /** The server's issues for this row. */
  readonly issues = input<LoadIssue[]>([]);
  readonly saving = input(false);
  readonly error = input<string | null>(null);

  readonly applied = output<LoadRow>();
  readonly closed = output<void>();

  readonly keys = COMPONENT_KEYS;
  readonly labels = COLUMN_LABELS;
  readonly help = COLUMN_HELP;
  readonly categories = COMPONENT_CATEGORIES;
  categoryOption = categoryOption;

  row!: LoadRow;
  readonly groupList = signal<CourseGroup[]>([]);
  readonly addingGroup = signal(false);
  readonly groupBusy = signal(false);
  readonly groupError = signal<string | null>(null);
  newGroupCode = '';
  newGroupName = '';

  ngOnInit(): void {
    this.row = structuredClone(this.initial());
    this.groupList.set(this.groups());
  }

  isNew(): boolean { return !this.initial().rowId; }

  /** Provisional sum of a column's items while editing. */
  sum(k: ComponentKey): number {
    return this.row.components[k].items.reduce((s, i) => s + (Number(i.count) || 0) * (Number(i.maxMarksEach) || 0), 0);
  }

  setTotal(k: ComponentKey, value: number | null): void {
    const c = this.row.components[k];
    c.totalMarks = Number(value) || 0;
    if (!c.totalMarks) { c.items = []; return; }
    if (k === 'ese' || k === 'oePoe') {
      c.items = [{ category: c.items[0]?.category ?? COMPONENT_CATEGORIES[k][0], count: 1, maxMarksEach: c.totalMarks }];
    } else if (!c.items.length) {
      c.items = [{ category: COMPONENT_CATEGORIES[k][0], count: 1, maxMarksEach: c.totalMarks }];
    }
  }

  setSingle(k: ComponentKey, category: AssessmentCategory): void {
    this.row.components[k].items = [{ category, count: 1, maxMarksEach: this.row.components[k].totalMarks }];
  }

  addItem(k: ComponentKey): void {
    this.row.components[k].items.push({ category: COMPONENT_CATEGORIES[k][0], count: 1, maxMarksEach: 5 });
  }

  removeItem(k: ComponentKey, i: number): void {
    this.row.components[k].items.splice(i, 1);
  }

  toggleOptions(on: boolean): void {
    this.row.options = on ? (this.row.options?.length ? this.row.options : [{ courseCode: '', courseName: '', offered: true }]) : undefined;
  }

  addGroup(): void {
    this.groupBusy.set(true);
    this.groupError.set(null);
    this.api.addCourseGroup({ code: this.newGroupCode, name: this.newGroupName }).subscribe({
      next: g => {
        this.groupBusy.set(false);
        this.groupList.update(list => [...list, g]);
        this.row.groupCode = g.code;
        this.addingGroup.set(false);
        this.newGroupCode = this.newGroupName = '';
      },
      error: (e: WorkspaceError) => {
        this.groupBusy.set(false);
        this.groupError.set(Object.values(e.fieldErrors ?? {})[0] ?? e.message);
      },
    });
  }

  apply(): void {
    const r = structuredClone(this.row);
    const n = (v: unknown) => Number(v) || 0;
    r.courseCode = r.courseCode.trim();
    r.courseName = r.courseName.trim();
    r.hours = { lecture: n(r.hours.lecture), tutorial: n(r.hours.tutorial), practical: n(r.hours.practical) };
    r.credits = n(r.credits);
    for (const k of COMPONENT_KEYS) {
      const c = r.components[k];
      c.totalMarks = n(c.totalMarks);
      c.items = c.totalMarks ? c.items.map(i => ({ ...i, count: n(i.count), maxMarksEach: n(i.maxMarksEach) })) : [];
    }
    r.options = r.options?.map(o => ({
      ...o, courseCode: o.courseCode.trim(), courseName: o.courseName.trim(),
      offeringDepartment: o.offeringDepartment?.trim() || undefined,
    }));
    if (r.moocAlternative) r.moocAlternative = { note: r.moocAlternative.note?.trim() || undefined };
    this.applied.emit(r);
  }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }
}
