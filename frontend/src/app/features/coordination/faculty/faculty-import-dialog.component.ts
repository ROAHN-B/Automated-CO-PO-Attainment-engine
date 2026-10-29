import { NgClass } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import { FACULTY_IMPORT_COLUMNS, FacultyImportPreview, FacultyImportResult, FacultyImportRow } from '../../../core/models/coordination.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';

type ImportStage = 'pick' | 'reading' | 'preview' | 'importing' | 'done';

/**
 * Import faculty from Excel (CRD-16 to CRD-18): choose a file, review the
 * server's preview with every row's problems, then confirm. Nothing is saved
 * until the coordinator confirms, and only valid rows are imported.
 */
@Component({
  selector: 'app-faculty-import-dialog',
  standalone: true,
  imports: [NgClass, IconComponent, BodyPortalDirective],
  template: `
    <div class="modal-backdrop" appBodyPortal (click)="close()">
      <div class="modal flex max-h-[92vh] max-w-4xl flex-col" role="dialog" aria-modal="true" aria-labelledby="fi-title" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h3 id="fi-title" class="font-serif text-2xl font-light text-ink">Import faculty from Excel</h3>
            <p class="mt-1 text-sm text-ink-soft">
              @switch (stage()) {
                @case ('preview') { Check the rows below. Only rows marked “Ready” are imported. }
                @case ('done') { Import finished. }
                @default { One row per faculty member, with these columns: {{ columns.join(', ') }}. }
              }
            </p>
          </div>
          <button type="button" class="btn btn-ghost btn-icon" (click)="close()" [disabled]="busy()" aria-label="Close">
            <app-icon name="close" class="h-5 w-5" />
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          @switch (stage()) {
            @case ('done') {
              @if (result(); as r) {
                <div class="empty-state py-10">
                  <app-icon name="check" class="h-6 w-6 text-ink" [stroke]="2" />
                  <p class="empty-title">{{ r.created.length }} faculty {{ r.created.length === 1 ? 'member' : 'members' }} added</p>
                  @if (r.skipped) { <p class="empty-text">{{ r.skipped }} {{ r.skipped === 1 ? 'row was' : 'rows were' }} skipped because of the problems shown in the preview.</p> }
                </div>
              }
            }
            @case ('preview') {
              @if (preview(); as p) {
                <p class="flex items-center gap-2 text-sm text-ink-soft"><app-icon name="document" class="h-4 w-4" /> {{ p.fileName }}</p>

                @if (p.fileErrors.length) {
                  <div class="alert alert-error mt-4" role="alert">
                    <app-icon name="alert" class="mt-0.5 h-4 w-4" />
                    <div>
                      <p class="font-semibold">This file can’t be imported</p>
                      <ul class="mt-1 list-disc pl-4">@for (e of p.fileErrors; track e) { <li>{{ e }}</li> }</ul>
                      <p class="mt-1">Use the template, keep the header row, and upload it again.</p>
                    </div>
                  </div>
                } @else {
                  <div class="mt-4 flex flex-wrap gap-2" aria-label="Summary">
                    <span class="chip chip-neutral"><strong class="tnum">{{ p.counts.valid }}</strong>&nbsp;ready to import</span>
                    @if (p.counts.invalid) { <span class="chip chip-gap"><strong class="tnum">{{ p.counts.invalid }}</strong>&nbsp;with errors</span> }
                    @if (p.counts.duplicateInFile) { <span class="chip chip-brand"><strong class="tnum">{{ p.counts.duplicateInFile }}</strong>&nbsp;repeated in the file</span> }
                    @if (p.counts.alreadyExists) { <span class="chip chip-brand"><strong class="tnum">{{ p.counts.alreadyExists }}</strong>&nbsp;already in the list</span> }
                  </div>

                  @if (problemCount()) {
                    <label class="mt-4 flex items-center gap-2 text-sm text-ink-soft">
                      <input type="checkbox" [checked]="problemsOnly()" (change)="problemsOnly.set($any($event.target).checked)" />
                      Show only the {{ problemCount() }} {{ problemCount() === 1 ? 'row' : 'rows' }} that won’t be imported
                    </label>
                  }

                  <div class="table-wrap mt-4 rounded-lg border border-line">
                    <table class="data-table">
                      <thead>
                        <tr><th class="th">Row</th><th class="th">Name</th><th class="th">Email</th><th class="th">Phone</th><th class="th">Status</th></tr>
                      </thead>
                      <tbody>
                        @for (r of shownRows(); track r.rowNumber) {
                          <tr>
                            <td class="td tnum text-ink-muted">{{ r.rowNumber }}</td>
                            <td class="td text-ink" [ngClass]="{ 'text-gap': hasError(r, 'firstName') || hasError(r, 'lastName') }">{{ (r.firstName + ' ' + r.lastName).trim() || '—' }}</td>
                            <td class="td" [ngClass]="{ 'text-gap': hasError(r, 'email') }">{{ r.email || '—' }}</td>
                            <td class="td tnum" [ngClass]="{ 'text-gap': hasError(r, 'phone') }">{{ r.phone || '—' }}</td>
                            <td class="td">
                              <span class="chip" [ngClass]="statusChip[r.status]">{{ statusLabel[r.status] }}</span>
                              @if (r.errors.length) {
                                <ul class="mt-1.5 space-y-0.5 text-xs text-gap">@for (e of r.errors; track e.field) { <li>{{ e.message }}</li> }</ul>
                              }
                            </td>
                          </tr>
                        } @empty {
                          <tr><td class="td text-center text-ink-muted" colspan="5">No rows with problems.</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }
            }
            @default {
              <label class="dropzone cursor-pointer" [class.dropzone-active]="dragging()"
                     (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
                @if (stage() === 'reading') {
                  <span class="spinner"></span>
                  <span class="text-sm text-ink-soft">Reading {{ fileName() }}…</span>
                } @else {
                  <app-icon name="upload" class="h-6 w-6 text-ink-muted" />
                  <span class="text-sm font-semibold text-ink">Drop the Excel file here, or choose it</span>
                  <span class="text-xs text-ink-muted">.xlsx, up to 2 MB and 500 faculty</span>
                  <input type="file" class="sr-only" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" (change)="onPick($event)" />
                }
              </label>
              <p class="mt-4 text-sm text-ink-soft">
                No file yet?
                <button type="button" class="link-accent" (click)="downloadTemplate()" [disabled]="templateBusy()">Download the template</button>
                and fill one row per faculty member. Faculty already in the list are skipped, never overwritten.
              </p>
            }
          }

          @if (error()) {
            <div class="alert alert-error mt-4" role="alert">
              <app-icon name="alert" class="mt-0.5 h-4 w-4" />
              <p>{{ error() }}</p>
            </div>
          }
        </div>

        <div class="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
          @switch (stage()) {
            @case ('done') {
              <button type="button" class="btn btn-primary" (click)="close()">Done</button>
            }
            @case ('pick') {
              <button type="button" class="btn btn-ghost" (click)="close()">Cancel</button>
            }
            @case ('reading') {
              <button type="button" class="btn btn-ghost" disabled>Cancel</button>
            }
            @default {
              <button type="button" class="btn btn-ghost mr-auto" [disabled]="busy()" (click)="restart()">Choose another file</button>
              <button type="button" class="btn btn-ghost" [disabled]="busy()" (click)="close()">Cancel</button>
              <button type="button" class="btn btn-primary" [disabled]="busy() || !canImport()" (click)="commit()">
                @if (stage() === 'importing') { <span class="spinner"></span> Importing… }
                @else { Import {{ preview()?.counts?.valid ?? 0 }} faculty }
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class FacultyImportDialogComponent {
  private readonly api = inject(CoordinationService);

  /** Emitted after a successful import, so the list can reload. */
  readonly imported = output<FacultyImportResult>();
  readonly closed = output<void>();

  readonly columns = [...FACULTY_IMPORT_COLUMNS];
  readonly stage = signal<ImportStage>('pick');
  readonly fileName = signal('');
  readonly preview = signal<FacultyImportPreview | null>(null);
  readonly result = signal<FacultyImportResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly dragging = signal(false);
  readonly problemsOnly = signal(false);
  readonly templateBusy = signal(false);

  readonly busy = computed(() => this.stage() === 'reading' || this.stage() === 'importing');
  readonly problemCount = computed(() => this.preview()?.rows.filter(r => r.status !== 'VALID').length ?? 0);
  readonly shownRows = computed(() => {
    const rows = this.preview()?.rows ?? [];
    return this.problemsOnly() ? rows.filter(r => r.status !== 'VALID') : rows;
  });
  readonly canImport = computed(() => {
    const p = this.preview();
    return !!p && !p.fileErrors.length && p.counts.valid > 0;
  });

  readonly statusLabel: Record<FacultyImportRow['status'], string> = {
    VALID: 'Ready', INVALID: 'Has errors', DUPLICATE_IN_FILE: 'Repeated in the file', ALREADY_EXISTS: 'Already in the list',
  };
  readonly statusChip: Record<FacultyImportRow['status'], string> = {
    VALID: 'chip-neutral', INVALID: 'chip-gap', DUPLICATE_IN_FILE: 'chip-brand', ALREADY_EXISTS: 'chip-brand',
  };

  hasError(r: FacultyImportRow, field: string): boolean {
    return r.errors.some(e => e.field === field);
  }

  onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.upload(file);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.upload(file);
  }

  upload(file: File): void {
    this.error.set(null);
    this.fileName.set(file.name);
    this.stage.set('reading');
    this.api.importFaculty(file).subscribe({
      next: p => { this.preview.set(p); this.problemsOnly.set(false); this.stage.set('preview'); },
      error: (e: WorkspaceError) => { this.error.set(e.message); this.stage.set('pick'); },
    });
  }

  commit(): void {
    const p = this.preview();
    if (!p) return;
    this.error.set(null);
    this.stage.set('importing');
    this.api.commitImport(p.importId).subscribe({
      next: r => { this.result.set(r); this.stage.set('done'); this.imported.emit(r); },
      error: (e: WorkspaceError) => { this.error.set(e.message); this.stage.set('preview'); },
    });
  }

  restart(): void {
    this.preview.set(null);
    this.error.set(null);
    this.stage.set('pick');
  }

  downloadTemplate(): void {
    this.templateBusy.set(true);
    this.api.facultyTemplate().subscribe({
      next: f => {
        this.templateBusy.set(false);
        const a = document.createElement('a');
        a.href = f.downloadUrl;
        a.download = f.fileName;
        a.click();
      },
      error: (e: WorkspaceError) => { this.templateBusy.set(false); this.error.set(e.message); },
    });
  }

  close(): void {
    if (!this.busy()) this.closed.emit();
  }
}
