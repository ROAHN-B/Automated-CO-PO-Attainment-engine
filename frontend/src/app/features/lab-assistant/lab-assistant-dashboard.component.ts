import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '../../shared/ui/icon.component';

interface MarksheetUploadRecord {
  id: string;
  courseName: string;
  assessmentName: string;
  fileName: string;
  uploadedAt: string;
  status: 'PENDING_REVIEW' | 'APPROVED_BY_FACULTY';
}

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // ASSUMPTION — real limit is server-configured (API_CONTRACT §13)

@Component({
  selector: 'app-lab-assistant-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="page stagger">
      <header class="page-header" style="--i:0">
        <div>
          <p class="page-kicker">Assessments · Marks</p>
          <h1 class="page-title">Marksheet upload</h1>
          <p class="page-subtitle">Upload question-wise marks for an assessment. The course faculty reviews each file before it counts towards attainment.</p>
        </div>
      </header>

      <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">

        <!-- Upload form -->
        <section class="card self-start" style="--i:1" aria-labelledby="upload-title">
          <div class="card-header">
            <h2 id="upload-title" class="section-title">New marksheet</h2>
          </div>

          <form [formGroup]="uploadForm" (ngSubmit)="onSubmit()" class="card-body space-y-5" novalidate>
            <div class="field">
              <label for="course" class="field-label">Course</label>
              <select id="course" formControlName="courseId" class="field-select">
                <option value="CS501">CS501 · Data Structures</option>
                <option value="EC301">EC301 · Digital Signal Processing</option>
                <option value="CS602">CS602 · Artificial Intelligence</option>
              </select>
            </div>

            <div class="field">
              <label for="assessment" class="field-label">Assessment</label>
              <select id="assessment" formControlName="assessmentName" class="field-select">
                <option value="Internal Test 1">Internal Test 1</option>
                <option value="Internal Test 2">Internal Test 2</option>
                <option value="Assignment 1">Assignment 1</option>
                <option value="End Semester Exam">End Semester Exam</option>
              </select>
            </div>

            <div class="field">
              <span class="field-label" id="file-label">Marksheet file</span>
              @if (selectedFile(); as file) {
                <div class="flex items-center gap-3 rounded-[10px] border border-line bg-paper px-3 py-2.5 animate-fade-in">
                  <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-met-50 text-met">
                    <app-icon name="table" class="h-4 w-4" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[13px] font-medium text-ink">{{ file.name }}</p>
                    <p class="text-xs text-ink-muted tnum">{{ formatSize(file.size) }}</p>
                  </div>
                  <button type="button" class="btn btn-ghost btn-icon h-8 w-8" (click)="clearFile()" aria-label="Remove file">
                    <app-icon name="close" class="h-4 w-4" />
                  </button>
                </div>
              } @else {
                <label class="dropzone cursor-pointer" [class.dropzone-active]="dragActive()"
                       (dragover)="onDragOver($event)" (dragleave)="dragActive.set(false)" (drop)="onDrop($event)"
                       aria-labelledby="file-label">
                  <app-icon name="upload" class="h-6 w-6 text-ink-muted" />
                  <span class="text-sm font-medium text-ink">Drop a file or <span class="text-brand-700 underline decoration-brand-300 underline-offset-2">browse</span></span>
                  <span class="text-xs text-ink-muted">.xlsx, .xls or .csv · up to 10 MB</span>
                  <input type="file" class="sr-only" [accept]="accept" (change)="onFileSelected($event)" />
                </label>
              }
              @if (fileError()) {
                <p class="field-error" role="alert">{{ fileError() }}</p>
              }
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="uploadForm.invalid || !selectedFile()">
              <app-icon name="upload" class="h-4 w-4" />
              Send to faculty
            </button>
          </form>
        </section>

        <!-- History -->
        <section class="card overflow-hidden" style="--i:2" aria-labelledby="history-title">
          <div class="card-header">
            <div>
              <h2 id="history-title" class="section-title">Submitted marksheets</h2>
              <p class="section-subtitle">Track each file through faculty review.</p>
            </div>
            <span class="chip chip-neutral tnum">{{ submissions().length }} files</span>
          </div>

          <p class="sr-only" aria-live="polite">{{ status() }}</p>
          @if (status()) {
            <div class="mx-5 mt-4 alert alert-success animate-fade-in" role="status">
              <app-icon name="check" class="mt-0.5 h-4 w-4" [stroke]="2" />
              <span>{{ status() }}</span>
            </div>
          }

          <div class="table-wrap">
            <table class="data-table min-w-[480px]">
              <thead>
                <tr>
                  <th class="th" scope="col">Assessment</th>
                  <th class="th" scope="col">File</th>
                  <th class="th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                @for (item of submissions(); track item.id) {
                  <tr class="animate-fade-in">
                    <td class="td">
                      <span class="block font-medium text-ink">{{ item.assessmentName }}</span>
                      <span class="mt-0.5 block font-mono text-xs text-ink-muted">{{ item.courseName }}</span>
                    </td>
                    <td class="td max-w-[240px]">
                      <span class="block truncate font-mono text-xs text-ink-soft" [title]="item.fileName">{{ item.fileName }}</span>
                      <span class="mt-0.5 block text-xs text-ink-muted tnum">{{ item.uploadedAt }}</span>
                    </td>
                    <td class="td">
                      @if (item.status === 'APPROVED_BY_FACULTY') {
                        <span class="chip chip-met"><span class="dot bg-met"></span>Approved</span>
                      } @else {
                        <span class="chip chip-partial"><span class="dot bg-partial"></span>Awaiting review</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3">
                      <div class="empty-state">
                        <p class="empty-title">No marksheets yet</p>
                        <p class="empty-text">Files you send to faculty will appear here with their review status.</p>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  `
})
export class LabAssistantDashboardComponent {
  private fb = inject(FormBuilder);

  readonly accept = ACCEPTED_EXTENSIONS.join(',');
  readonly selectedFile = signal<File | null>(null);
  readonly fileError = signal('');
  readonly dragActive = signal(false);
  readonly status = signal('');

  readonly submissions = signal<MarksheetUploadRecord[]>([
    { id: '1', courseName: 'CS501', assessmentName: 'Internal Test 1', fileName: 'CS501_IT1_Marks.xlsx', uploadedAt: '24 Sep 2026, 11:30', status: 'PENDING_REVIEW' },
    { id: '2', courseName: 'EC301', assessmentName: 'Assignment 1', fileName: 'EC301_Assign1_Marks.xlsx', uploadedAt: '22 Sep 2026, 15:15', status: 'APPROVED_BY_FACULTY' }
  ]);

  uploadForm: FormGroup = this.fb.group({
    courseId: ['CS501', Validators.required],
    assessmentName: ['Internal Test 1', Validators.required]
  });

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(input.files?.[0] ?? null);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    this.setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  clearFile(): void {
    this.selectedFile.set(null);
    this.fileError.set('');
  }

  formatSize(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  onSubmit(): void {
    const file = this.selectedFile();
    if (this.uploadForm.invalid || !file) return;

    const newRecord: MarksheetUploadRecord = {
      id: String(Date.now()),
      courseName: this.uploadForm.value.courseId,
      assessmentName: this.uploadForm.value.assessmentName,
      fileName: file.name,
      uploadedAt: new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      status: 'PENDING_REVIEW'
    };

    this.submissions.update(list => [newRecord, ...list]);
    this.selectedFile.set(null);
    this.status.set(`${file.name} was sent to the course faculty for review.`);
  }

  private setFile(file: File | null): void {
    this.fileError.set('');
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      this.fileError.set('Use an Excel (.xlsx, .xls) or CSV file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.fileError.set('This file is larger than 10 MB.');
      return;
    }
    this.selectedFile.set(file);
  }
}
