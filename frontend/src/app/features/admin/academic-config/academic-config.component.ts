import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AcademicStructureService } from '../../../core/services/academic-structure.service';
import { AcademicYear, Program } from '../../../core/models/academic-structure.model';

@Component({
  selector: 'app-academic-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div>
      <div class="mx-auto w-full max-w-6xl space-y-8 animate-enter">

        <!-- Header -->
        <div class="page-header">
          <div>
            <p class="page-kicker">Academic structure</p>
            <h1 class="page-title">Years and programs</h1>
            <p class="page-subtitle">Manage institutional timelines and degree programs based on the enterprise schema.</p>
          </div>
        </div>

        <!-- Alert Messages -->
        <div *ngIf="successMessage" class="alert alert-success">
          <p class="text-sm text-met font-medium">{{ successMessage }}</p>
        </div>
        <div *ngIf="errorMessage" class="alert alert-error">
          <p class="text-sm text-gap font-medium">{{ errorMessage }}</p>
        </div>

        <!-- Grid Layout for Setup Sections -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

          <!-- Section 1: Academic Years Management -->
          <div class="card p-6 space-y-6">
            <h3 class="section-title border-b border-line pb-3">1. Academic timelines (Years)</h3>
            
            <!-- List of Years -->
            <div class="space-y-3 max-h-64 overflow-y-auto pr-2">
              <div *ngFor="let ay of academicYears" class="p-3 bg-paper border border-line rounded-lg">
                <div class="flex justify-between items-center mb-1">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-ink">{{ ay.yearName }}</span>
                    <span class="chip chip-neutral">{{ ay.academicYearCode }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span *ngIf="ay.isCurrent" class="chip chip-brand">Current</span>
                    <span class="chip chip-met">{{ ay.status }}</span>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-ink-muted">{{ ay.startDate }} to {{ ay.endDate }}</span>
                  <span class="text-xs text-ink-muted italic truncate ml-4" *ngIf="ay.description">{{ ay.description }}</span>
                </div>
              </div>
            </div>

            <!-- Add Year Form -->
            <form [formGroup]="ayForm" (ngSubmit)="onAddAcademicYear()" class="space-y-4 pt-4 border-t border-line">
              <h4 class="text-sm font-semibold text-ink-soft">Add New Academic Year</h4>
              
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="field-label">Academic year code *</label>
                  <input type="text" formControlName="academicYearCode" placeholder="e.g. AY2026" class="field-input">
                </div>
                <div>
                  <label class="field-label">Year name *</label>
                  <input type="text" formControlName="yearName" placeholder="e.g. 2026-2027" class="field-input">
                </div>

                <div>
                  <label class="field-label">Start date *</label>
                  <input type="date" formControlName="startDate" class="field-input">
                </div>
                <div>
                  <label class="field-label">End date *</label>
                  <input type="date" formControlName="endDate" class="field-input">
                </div>

                <div class="col-span-2">
                  <label class="field-label">Description</label>
                  <input type="text" formControlName="description" placeholder="Optional remarks..." class="field-input">
                </div>

                <div>
                  <label class="field-label">Status</label>
                  <select formControlName="status" class="field-select">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
                <div class="flex items-center pt-5">
                  <input type="checkbox" formControlName="isCurrent" id="isCurrent" class="h-4 w-4 rounded border-line text-brand focus:ring-brand/40">
                  <label for="isCurrent" class="field-label">Set as Current Active Year</label>
                </div>
              </div>
              <button type="submit" [disabled]="ayForm.invalid" class="btn btn-primary w-full">
                Create Academic Year
              </button>
            </form>
          </div>

          <!-- Section 2: Programs Management -->
          <div class="card p-6 space-y-6">
            <h3 class="section-title border-b border-line pb-3">2. Degree programs</h3>
            
            <!-- List of Programs -->
            <div class="space-y-3 max-h-64 overflow-y-auto pr-2">
              <div *ngFor="let prog of programs" class="p-3 bg-paper border border-line rounded-lg">
                <div class="flex justify-between items-center">
                  <span class="font-semibold text-ink">{{ prog.programName }}</span>
                  <span class="chip chip-met">{{ prog.programShortName }}</span>
                </div>
                <p class="text-xs text-ink-muted mt-1">Duration: {{ prog.durationYears }} Years</p>
              </div>
            </div>

            <!-- Add Program Form -->
            <form [formGroup]="programForm" (ngSubmit)="onAddProgram()" class="space-y-4 pt-4 border-t border-line">
              <h4 class="text-sm font-semibold text-ink-soft">Register New Program</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="field-label">Program name *</label>
                  <input type="text" formControlName="programName" placeholder="e.g. Electronics and Computer Engineering" class="field-input">
                </div>
                <div>
                  <label class="field-label">Short name *</label>
                  <input type="text" formControlName="programShortName" placeholder="e.g. B.Tech ECM" class="field-input">
                </div>
                <div>
                  <label class="field-label">Duration (Years) *</label>
                  <input type="number" formControlName="durationYears" class="field-input">
                </div>
                <div class="col-span-2">
                  <label class="field-label">Status</label>
                  <select formControlName="status" class="field-select">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <button type="submit" [disabled]="programForm.invalid" class="btn btn-primary w-full">
                Register Program
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  `
})
export class AcademicConfigComponent implements OnInit {
  private academicService = inject(AcademicStructureService);
  private fb = inject(FormBuilder);

  academicYears: AcademicYear[] = [];
  programs: Program[] = [];

  ayForm!: FormGroup;
  programForm!: FormGroup;

  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    this.initForms();
    this.loadData();
  }

  private initForms(): void {
    // Updated Form Group based on EPIC-001 Schema
    this.ayForm = this.fb.group({
      academicYearCode: ['', [Validators.required]],
      yearName: ['', [Validators.required]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      isCurrent: [false],
      description: [''],
      status: ['ACTIVE', [Validators.required]]
    });

    this.programForm = this.fb.group({
      departmentId: ['dept_ecm', [Validators.required]], 
      programName: ['', [Validators.required]],
      programShortName: ['', [Validators.required]],
      durationYears: [4, [Validators.required, Validators.min(1)]],
      status: ['ACTIVE', [Validators.required]]
    });
  }

  private loadData(): void {
    this.academicService.getAcademicYears().subscribe(data => this.academicYears = data);
    this.academicService.getPrograms().subscribe(data => this.programs = data);
  }

  onAddAcademicYear(): void {
    if (this.ayForm.invalid) {
      this.errorMessage = 'Please complete all required fields correctly.';
      this.clearMessagesAfterDelay();
      return;
    }
    
    const { startDate, endDate, isCurrent } = this.ayForm.value;
    if (new Date(startDate) >= new Date(endDate)) {
      this.errorMessage = 'End date must be strictly after start date.';
      this.clearMessagesAfterDelay();
      return;
    }

    // Logic to simulate the "Only one active year" business rule from EPIC-001
    if (isCurrent) {
      this.academicYears.forEach(ay => ay.isCurrent = false);
    }

    const payload = { ...this.ayForm.value, institutionId: 'inst_01' };

    this.academicService.createAcademicYear(payload).subscribe({
      next: (res) => {
        this.academicYears.push(res);
        this.successMessage = `Academic Year ${res.yearName} created successfully.`;
        this.ayForm.reset({ status: 'ACTIVE', isCurrent: false });
        this.clearMessagesAfterDelay();
      },
      error: () => {
        this.errorMessage = 'Failed to create academic year.';
        this.clearMessagesAfterDelay();
      }
    });
  }

  onAddProgram(): void {
    if (this.programForm.invalid) return;

    this.academicService.createProgram(this.programForm.value).subscribe({
      next: (res) => {
        this.programs.push(res);
        this.successMessage = `Program ${res.programShortName} registered successfully.`;
        this.programForm.reset({ durationYears: 4, status: 'ACTIVE', departmentId: 'dept_ecm' });
        this.clearMessagesAfterDelay();
      },
      error: () => {
        this.errorMessage = 'Failed to register program.';
        this.clearMessagesAfterDelay();
      }
    });
  }

  private clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
    }, 4000);
  }
}