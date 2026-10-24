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
    <div>
      <div class="mx-auto w-full max-w-7xl space-y-8 animate-enter">

        <!-- Header -->
        <div class="page-header">
          <div>
            <p class="page-kicker">Outcomes</p>
            <h1 class="page-title">Course outcomes &amp; units</h1>
            <p class="page-subtitle">Manage Course Outcomes (COs) and Syllabus Units for outcome-based education.</p>
          </div>
        </div>

        <!-- Success/Error Alerts -->
        <div *ngIf="successMessage" class="alert alert-success">
          <p class="text-sm text-met font-medium">{{ successMessage }}</p>
        </div>
        <div *ngIf="errorMessage" class="alert alert-error">
          <p class="text-sm text-gap font-medium">{{ errorMessage }}</p>
        </div>

        <!-- Course Selector Bar -->
        <div class="card p-6">
          <label class="field-label">Select course to configure *</label>
          <select [formControl]="selectedCourseCtrl" class="field-select lg:w-1/2">
            <option value="">-- Choose a Course --</option>
            <option *ngFor="let course of courses" [value]="course.courseId">
              {{ course.courseCode }} - {{ course.courseName }}
            </option>
          </select>
        </div>

        <!-- Main Configuration Area (Visible when course is selected) -->
        <div *ngIf="selectedCourseCtrl.value" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <!-- Column 1: Course Outcomes (COs) -->
          <div class="card p-6 space-y-6">
            <div class="flex justify-between items-center border-b border-line pb-3">
              <h3 class="section-title text-ink">Course outcomes (COs)</h3>
              <span class="chip chip-neutral">{{ courseOutcomes.length }} Defined</span>
            </div>

            <!-- List of COs -->
            <div class="space-y-3 max-h-72 overflow-y-auto">
              <div *ngIf="courseOutcomes.length === 0" class="text-xs text-ink-muted italic text-center py-6 border border-dashed rounded-lg">
                No Course Outcomes defined yet.
              </div>
              <div *ngFor="let co of courseOutcomes" class="p-3 bg-paper border border-line rounded-lg space-y-1">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-ink">{{ co.coCode }}</span>
                  <span class="chip chip-brand">{{ co.targetBloomLevel }}</span>
                </div>
                <p class="text-xs text-ink-soft">{{ co.coStatement }}</p>
                <div class="text-[10px] text-ink-muted flex gap-4 pt-1">
                  <span>Target: {{ co.targetAttainment }}%</span>
                  <span>Weightage: {{ co.marksWeightage }} Marks</span>
                </div>
              </div>
            </div>

            <!-- Add CO Form -->
            <form [formGroup]="coForm" (ngSubmit)="onCreateCo()" class="space-y-3 pt-4 border-t border-line">
              <h4 class="text-xs font-bold text-ink-soft">Add New Course Outcome</h4>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-[10px] font-medium text-ink-muted mb-1">CO Code *</label>
                  <input type="text" formControlName="coCode" placeholder="CO1" class="field-input">
                </div>
                <div>
                  <label class="block text-[10px] font-medium text-ink-muted mb-1">Bloom Level</label>
                  <select formControlName="targetBloomLevel" class="field-select">
                    <option value="L1_REMEMBER">L1 - Remember</option>
                    <option value="L2_UNDERSTAND">L2 - Understand</option>
                    <option value="L3_APPLY">L3 - Apply</option>
                    <option value="L4_ANALYZE">L4 - Analyze</option>
                    <option value="L5_EVALUATE">L5 - Evaluate</option>
                    <option value="L6_CREATE">L6 - Create</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-medium text-ink-muted mb-1">Target %</label>
                  <input type="number" formControlName="targetAttainment" class="field-input">
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-medium text-ink-muted mb-1">CO Statement *</label>
                <textarea formControlName="coStatement" rows="2" placeholder="Describe measurable outcome..." class="field-textarea"></textarea>
              </div>
              <button type="submit" [disabled]="coForm.invalid" class="btn btn-primary btn-sm w-full">
                Save Course Outcome
              </button>
            </form>
          </div>

          <!-- Column 2: Syllabus Units -->
          <div class="card p-6 space-y-6">
            <div class="flex justify-between items-center border-b border-line pb-3">
              <h3 class="section-title text-ink">Syllabus units</h3>
              <span class="chip chip-neutral">{{ syllabusUnits.length }} Units</span>
            </div>

            <!-- List of Units -->
            <div class="space-y-3 max-h-72 overflow-y-auto">
              <div *ngIf="syllabusUnits.length === 0" class="text-xs text-ink-muted italic text-center py-6 border border-dashed rounded-lg">
                No syllabus units defined yet.
              </div>
              <div *ngFor="let unit of syllabusUnits" class="p-3 bg-paper border border-line rounded-lg space-y-1">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-ink">{{ unit.unitCode }}: {{ unit.unitTitle }}</span>
                  <span class="chip chip-partial">{{ unit.recommendedHours || 0 }} Hours</span>
                </div>
                <p class="text-xs text-ink-soft">{{ unit.unitDescription }}</p>
              </div>
            </div>

            <!-- Add Unit Form -->
            <form [formGroup]="unitForm" (ngSubmit)="onCreateUnit()" class="space-y-3 pt-4 border-t border-line">
              <h4 class="text-xs font-bold text-ink-soft">Add Syllabus Unit</h4>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-[10px] font-medium text-ink-muted mb-1">Unit Code *</label>
                  <input type="text" formControlName="unitCode" placeholder="U1" class="field-input">
                </div>
                <div class="col-span-2">
                  <label class="block text-[10px] font-medium text-ink-muted mb-1">Unit Title *</label>
                  <input type="text" formControlName="unitTitle" placeholder="Introduction to Data Structures" class="field-input">
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-medium text-ink-muted mb-1">Topics / Description</label>
                <textarea formControlName="unitDescription" rows="2" placeholder="Arrays, Linked Lists..." class="field-textarea"></textarea>
              </div>
              <button type="submit" [disabled]="unitForm.invalid" class="btn btn-primary btn-sm w-full">
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