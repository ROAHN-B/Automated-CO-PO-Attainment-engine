import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CourseObeService } from '../../../core/services/course-obe.service';
import { CourseStructureService } from '../../../core/services/course-structure.service';
import { CourseMaster } from '../../../core/models/course-structure.model';
import { CourseOutcomeEntity, CourseSyllabusUnit } from '../../../core/models/epic2-course-obe.model';
@Component({
  selector: 'app-course-obe-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-7xl mx-auto space-y-8">

        <!-- Header -->
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">OBE Master Management</h1>
            <p class="text-slate-600 mt-1">Manage Course Outcomes (COs) and Syllabus Units for outcome-based education.</p>
          </div>
        </div>

        <!-- Success/Error Alerts -->
        <div *ngIf="successMessage" class="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
          <p class="text-sm text-emerald-700 font-medium">{{ successMessage }}</p>
        </div>
        <div *ngIf="errorMessage" class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <p class="text-sm text-red-700 font-medium">{{ errorMessage }}</p>
        </div>

        <!-- Course Selector Bar -->
        <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
          <label class="block text-xs font-medium text-slate-600 mb-1">Select Course to Configure *</label>
          <select [formControl]="selectedCourseCtrl" class="w-full lg:w-1/2 px-3 py-2 text-sm border border-slate-300 rounded-md">
            <option value="">-- Choose a Course --</option>
            <option *ngFor="let course of courses" [value]="course.courseId">
              {{ course.courseCode }} - {{ course.courseName }}
            </option>
          </select>
        </div>

        <!-- Main Configuration Area (Visible when course is selected) -->
        <div *ngIf="selectedCourseCtrl.value" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <!-- Column 1: Course Outcomes (COs) -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-6">
            <div class="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 class="text-lg font-bold text-slate-900">Course Outcomes (COs)</h3>
              <span class="px-2.5 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full font-medium">{{ courseOutcomes.length }} Defined</span>
            </div>

            <!-- List of COs -->
            <div class="space-y-3 max-h-72 overflow-y-auto">
              <div *ngIf="courseOutcomes.length === 0" class="text-xs text-slate-400 italic text-center py-6 border border-dashed rounded-lg">
                No Course Outcomes defined yet.
              </div>
              <div *ngFor="let co of courseOutcomes" class="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-slate-900">{{ co.coCode }}</span>
                  <span class="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded">{{ co.targetBloomLevel }}</span>
                </div>
                <p class="text-xs text-slate-600">{{ co.coStatement }}</p>
                <div class="text-[10px] text-slate-400 flex gap-4 pt-1">
                  <span>Target: {{ co.targetAttainment }}%</span>
                  <span>Weightage: {{ co.marksWeightage }} Marks</span>
                </div>
              </div>
            </div>

            <!-- Add CO Form -->
            <form [formGroup]="coForm" (ngSubmit)="onCreateCo()" class="space-y-3 pt-4 border-t border-slate-100">
              <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Add New Course Outcome</h4>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-[10px] font-medium text-slate-500 mb-1">CO Code *</label>
                  <input type="text" formControlName="coCode" placeholder="CO1" class="w-full px-2 py-1.5 text-xs border rounded">
                </div>
                <div>
                  <label class="block text-[10px] font-medium text-slate-500 mb-1">Bloom Level</label>
                  <select formControlName="targetBloomLevel" class="w-full px-2 py-1.5 text-xs border rounded">
                    <option value="L1_REMEMBER">L1 - Remember</option>
                    <option value="L2_UNDERSTAND">L2 - Understand</option>
                    <option value="L3_APPLY">L3 - Apply</option>
                    <option value="L4_ANALYZE">L4 - Analyze</option>
                    <option value="L5_EVALUATE">L5 - Evaluate</option>
                    <option value="L6_CREATE">L6 - Create</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-medium text-slate-500 mb-1">Target %</label>
                  <input type="number" formControlName="targetAttainment" class="w-full px-2 py-1.5 text-xs border rounded">
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-medium text-slate-500 mb-1">CO Statement *</label>
                <textarea formControlName="coStatement" rows="2" placeholder="Describe measurable outcome..." class="w-full px-2 py-1.5 text-xs border rounded"></textarea>
              </div>
              <button type="submit" [disabled]="coForm.invalid" class="w-full py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:opacity-50">
                Save Course Outcome
              </button>
            </form>
          </div>

          <!-- Column 2: Syllabus Units -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-6">
            <div class="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 class="text-lg font-bold text-slate-900">Syllabus Units</h3>
              <span class="px-2.5 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full font-medium">{{ syllabusUnits.length }} Units</span>
            </div>

            <!-- List of Units -->
            <div class="space-y-3 max-h-72 overflow-y-auto">
              <div *ngIf="syllabusUnits.length === 0" class="text-xs text-slate-400 italic text-center py-6 border border-dashed rounded-lg">
                No syllabus units defined yet.
              </div>
              <div *ngFor="let unit of syllabusUnits" class="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-slate-900">{{ unit.unitCode }}: {{ unit.unitTitle }}</span>
                  <span class="text-[10px] bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded">{{ unit.recommendedHours || 0 }} Hours</span>
                </div>
                <p class="text-xs text-slate-600">{{ unit.unitDescription }}</p>
              </div>
            </div>

            <!-- Add Unit Form -->
            <form [formGroup]="unitForm" (ngSubmit)="onCreateUnit()" class="space-y-3 pt-4 border-t border-slate-100">
              <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Add Syllabus Unit</h4>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-[10px] font-medium text-slate-500 mb-1">Unit Code *</label>
                  <input type="text" formControlName="unitCode" placeholder="U1" class="w-full px-2 py-1.5 text-xs border rounded">
                </div>
                <div class="col-span-2">
                  <label class="block text-[10px] font-medium text-slate-500 mb-1">Unit Title *</label>
                  <input type="text" formControlName="unitTitle" placeholder="Introduction to Data Structures" class="w-full px-2 py-1.5 text-xs border rounded">
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-medium text-slate-500 mb-1">Topics / Description</label>
                <textarea formControlName="unitDescription" rows="2" placeholder="Arrays, Linked Lists..." class="w-full px-2 py-1.5 text-xs border rounded"></textarea>
              </div>
              <button type="submit" [disabled]="unitForm.invalid" class="w-full py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:opacity-50">
                Save Syllabus Unit
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  `
})
export class CourseObeManagementComponent implements OnInit {
  private courseStructureService = inject(CourseStructureService);
  private obeService = inject(CourseObeService);
  private fb = inject(FormBuilder);

  courses: CourseMaster[] = [];
  courseOutcomes: CourseOutcomeEntity[] = [];
  syllabusUnits: CourseSyllabusUnit[] = [];

  selectedCourseCtrl = this.fb.control('');
  coForm!: FormGroup;
  unitForm!: FormGroup;

  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    this.initForms();
    this.loadCourses();
    this.setupCourseListener();
  }

  private initForms(): void {
    this.coForm = this.fb.group({
      coCode: ['', Validators.required],
      coStatement: ['', Validators.required],
      targetBloomLevel: ['L3_APPLY', Validators.required],
      targetAttainment: [70, [Validators.required, Validators.min(0), Validators.max(100)]],
      marksWeightage: [20, Validators.required],
      displayOrder: [1, Validators.required],
      status: ['ACTIVE']
    });

    this.unitForm = this.fb.group({
      unitCode: ['', Validators.required],
      unitTitle: ['', Validators.required],
      unitDescription: [''],
      recommendedHours: [8, Validators.required],
      displayOrder: [1, Validators.required],
      status: ['ACTIVE']
    });
  }

  private loadCourses(): void {
    this.courseStructureService.getCourses().subscribe(data => this.courses = data);
  }

  private setupCourseListener(): void {
    this.selectedCourseCtrl.valueChanges.subscribe(courseId => {
      this.courseOutcomes = [];
      this.syllabusUnits = [];
      if (courseId) {
        this.obeService.getCourseOutcomes(courseId).subscribe(cos => this.courseOutcomes = cos);
      }
    });
  }

  onCreateCo(): void {
    if (this.coForm.invalid || !this.selectedCourseCtrl.value) return;

    const payload = {
      ...this.coForm.value,
      courseId: this.selectedCourseCtrl.value,
      academicYearId: 'ay_2026'
    };

    this.obeService.createCourseOutcome(payload).subscribe({
      next: (res) => {
        this.courseOutcomes.push(res);
        this.successMessage = `Course Outcome ${res.coCode} created successfully.`;
        this.coForm.patchValue({ coCode: '', coStatement: '' });
        this.clearMessages();
      },
      error: () => {
        this.errorMessage = 'Failed to create Course Outcome.';
        this.clearMessages();
      }
    });
  }

  onCreateUnit(): void {
    if (this.unitForm.invalid || !this.selectedCourseCtrl.value) return;

    const newUnit: CourseSyllabusUnit = {
      ...this.unitForm.value,
      _id: 'unit_' + Date.now(),
      courseId: this.selectedCourseCtrl.value,
      academicYearId: 'ay_2026'
    };

    this.syllabusUnits.push(newUnit);
    this.successMessage = `Syllabus Unit ${newUnit.unitCode} added successfully.`;
    this.unitForm.patchValue({ unitCode: '', unitTitle: '', unitDescription: '' });
    this.clearMessages();
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
    }, 4000);
  }
}