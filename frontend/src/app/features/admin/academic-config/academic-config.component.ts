import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AcademicStructureService } from '../../../core/services/academic-structure.service';
import { AcademicYear, Program } from '../../../core/models/academic-structure.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-academic-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-6xl mx-auto space-y-8">

        <!-- Header -->
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Academic Structure Configuration</h1>
            <p class="text-slate-600 mt-1">Manage institutional timelines and degree programs based on the V1 schema.</p>
          </div>
        </div>

        <!-- Alert Messages -->
        <div *ngIf="successMessage" class="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
          <p class="text-sm text-emerald-700 font-medium">{{ successMessage }}</p>
        </div>
        <div *ngIf="errorMessage" class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <p class="text-sm text-red-700 font-medium">{{ errorMessage }}</p>
        </div>

        <!-- Grid Layout for Setup Sections -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">

          <!-- Section 1: Academic Years Management -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-6">
            <h3 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">1. Academic Timelines (Years)</h3>
            
            <!-- List of Years -->
            <div class="space-y-3">
              <div *ngFor="let ay of academicYears" class="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span class="font-semibold text-slate-800">{{ ay.yearName }}</span>
                <span class="text-xs text-slate-500">{{ ay.startDate }} to {{ ay.endDate }}</span>
              </div>
            </div>

            <!-- Add Year Form -->
            <form [formGroup]="ayForm" (ngSubmit)="onAddAcademicYear()" class="space-y-4 pt-4 border-t border-slate-100">
              <h4 class="text-sm font-semibold text-slate-700">Add New Academic Year</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">Year Name *</label>
                  <input type="text" formControlName="yearName" placeholder="e.g. 2026-2027" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                  <input type="date" formControlName="startDate" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
                  <input type="date" formControlName="endDate" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select formControlName="status" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <button type="submit" [disabled]="ayForm.invalid" class="w-full py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors">
                Create Academic Year
              </button>
            </form>
          </div>

          <!-- Section 2: Programs Management -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-6">
            <h3 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">2. Degree Programs</h3>
            
            <!-- List of Programs -->
            <div class="space-y-3">
              <div *ngFor="let prog of programs" class="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div class="flex justify-between items-center">
                  <span class="font-semibold text-slate-800">{{ prog.programName }}</span>
                  <span class="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full font-medium">{{ prog.programShortName }}</span>
                </div>
                <p class="text-xs text-slate-500 mt-1">Duration: {{ prog.durationYears }} Years</p>
              </div>
            </div>

            <!-- Add Program Form -->
            <form [formGroup]="programForm" (ngSubmit)="onAddProgram()" class="space-y-4 pt-4 border-t border-slate-100">
              <h4 class="text-sm font-semibold text-slate-700">Register New Program</h4>
              <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">Program Name *</label>
                  <input type="text" formControlName="programName" placeholder="e.g. Electronics and Computer Engineering" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Short Name *</label>
                  <input type="text" formControlName="programShortName" placeholder="e.g. B.Tech ECM" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Duration (Years) *</label>
                  <input type="number" formControlName="durationYears" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select formControlName="status" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <button type="submit" [disabled]="programForm.invalid" class="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                Register Program
              </button>
            </form>
          </div>

        </div>

        <!-- Proceed to Next Setup Step Bar -->
        <div class="pt-4 flex justify-end">
          <button 
            type="button" 
            (click)="goToNextStep()"
            class="px-6 py-3 bg-slate-900 text-white font-semibold text-sm rounded-lg shadow hover:bg-slate-800 transition flex items-center gap-2">
            Proceed to Course Master Setup 
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  `
})
export class AcademicConfigComponent implements OnInit {
  private academicService = inject(AcademicStructureService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

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
    this.ayForm = this.fb.group({
      yearName: ['', [Validators.required]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      status: ['ACTIVE', [Validators.required]]
    });

    this.programForm = this.fb.group({
      departmentId: ['dept_ecm', [Validators.required]], // Default context for testing
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
    
    // Check end_date > start_date constraint
    const { startDate, endDate } = this.ayForm.value;
    if (new Date(startDate) >= new Date(endDate)) {
      this.errorMessage = 'End date must be strictly after start date.';
      this.clearMessagesAfterDelay();
      return;
    }

    const payload = { ...this.ayForm.value, institutionId: 'inst_01' };

    this.academicService.createAcademicYear(payload).subscribe({
      next: (res) => {
        this.academicYears.push(res);
        this.successMessage = `Academic Year ${res.yearName} created successfully.`;
        this.ayForm.reset({ status: 'ACTIVE' });
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

  goToNextStep(): void {
    this.router.navigate(['/admin/course-master']);
  }

  private clearMessagesAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
    }, 4000);
  }
}