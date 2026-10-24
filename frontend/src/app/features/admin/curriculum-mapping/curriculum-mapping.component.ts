import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AcademicStructureService } from '../../../core/services/academic-structure.service';
import { CourseStructureService } from '../../../core/services/course-structure.service';
import { Curriculum, Semester } from '../../../core/models/academic-structure.model';
import { CourseMaster, CurriculumCourse } from '../../../core/models/course-structure.model';

@Component({
  selector: 'app-curriculum-mapping',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div>
      <div class="mx-auto w-full max-w-7xl space-y-8 animate-enter">

        <!-- Header -->
        <div class="page-header">
          <div>
            <p class="page-kicker">Academic structure</p>
            <h1 class="page-title">Curriculum</h1>
            <p class="page-subtitle">Map courses to specific curriculum semesters and define credit rules.</p>
          </div>
        </div>

        <!-- Alerts -->
        <div *ngIf="successMessage" class="alert alert-success">
          <p class="text-sm text-met font-medium">{{ successMessage }}</p>
        </div>
        <div *ngIf="errorMessage" class="alert alert-error">
          <p class="text-sm text-gap font-medium">{{ errorMessage }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Left Column: Context Selection & Mapped Courses -->
          <div class="lg:col-span-2 space-y-6">
            
            <!-- Context Selectors -->
            <div class="card p-6 flex gap-4">
              <div class="flex-1">
                <label class="field-label">Select curriculum</label>
                <select [formControl]="curriculumCtrl" class="field-select">
                  <option value="">-- Select Curriculum --</option>
                  <option *ngFor="let curr of curriculums" [value]="curr.curriculumId">Curriculum {{ curr.curriculumYear }}</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="field-label">Select semester</label>
                <select [formControl]="semesterCtrl" class="field-select" [disabled]="!curriculumCtrl.value">
                  <option value="">-- Select Semester --</option>
                  <option *ngFor="let sem of semesters" [value]="sem.semesterId">{{ sem.semesterName }}</option>
                </select>
              </div>
            </div>

            <!-- Mapped Courses List -->
            <div class="card p-6" *ngIf="semesterCtrl.value">
              <h3 class="section-title border-b border-line pb-3 mb-4">Mapped courses for semester</h3>
              
              <div *ngIf="mappedCourses.length === 0" class="text-sm text-ink-muted italic py-4 text-center border-2 border-dashed border-line rounded-lg">
                No courses mapped to this semester yet.
              </div>

              <div class="space-y-3" *ngIf="mappedCourses.length > 0">
                <div *ngFor="let mapping of mappedCourses" class="flex justify-between items-center p-3 bg-paper border border-line rounded-lg">
                  <div>
                    <span class="font-semibold text-ink">{{ getCourseName(mapping.courseId) }}</span>
                    <div class="text-xs text-ink-muted mt-0.5 space-x-2">
                      <span>Credits: {{ mapping.credits }}</span>
                      <span *ngIf="mapping.isElective" class="text-partial font-medium">• Elective</span>
                      <span *ngIf="mapping.isMandatory" class="text-brand-700 font-medium">• Mandatory</span>
                    </div>
                  </div>
                  <span class="chip chip-met">{{ mapping.status }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Mapping Form -->
          <div class="card p-6 h-fit sticky top-6">
            <h3 class="section-title border-b border-line pb-3 mb-4">Map new course</h3>
            
            <form [formGroup]="mappingForm" (ngSubmit)="onMapCourse()" class="space-y-4">
              <div>
                <label class="field-label">Select course master *</label>
                <select formControlName="courseId" class="field-select">
                  <option value="">-- Select Course --</option>
                  <option *ngFor="let course of availableCourses" [value]="course.courseId">
                    {{ course.courseCode }} - {{ course.courseName }}
                  </option>
                </select>
              </div>

              <div>
                <label class="field-label">Curriculum credits *</label>
                <input type="number" formControlName="credits" class="field-input">
                <p class="text-[10px] text-ink-muted mt-1">Can override the master course default.</p>
              </div>

              <div class="flex items-center gap-2 pt-2">
                <input type="checkbox" formControlName="isMandatory" id="isMandatory" class="h-4 w-4 rounded border-line text-brand focus:ring-brand/40">
                <label for="isMandatory" class="field-label">Is Mandatory?</label>
              </div>

              <div class="flex items-center gap-2 pb-2">
                <input type="checkbox" formControlName="isElective" id="isElective" class="h-4 w-4 rounded border-line text-brand focus:ring-brand/40">
                <label for="isElective" class="field-label">Is Elective?</label>
              </div>

              <div>
                <label class="field-label">Status</label>
                <select formControlName="status" class="field-select">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button type="submit" [disabled]="mappingForm.invalid || !semesterCtrl.value" class="btn btn-primary w-full">
                Map Course to Semester
              </button>
            </form>
          </div>

        </div>

        <!-- Proceed to Next Setup Step Bar -->
        <div class="pt-4 flex justify-end">
          <button 
            type="button" 
            (click)="goToNextStep()"
            class="btn btn-primary">
            Continue to elective groups
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  `
})
export class CurriculumMappingComponent implements OnInit {
  private academicService = inject(AcademicStructureService);
  private courseService = inject(CourseStructureService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  curriculums: Curriculum[] = [];
  semesters: Semester[] = [];
  availableCourses: CourseMaster[] = [];
  mappedCourses: CurriculumCourse[] = [];

  curriculumCtrl = this.fb.control('');
  semesterCtrl = this.fb.control('');
  mappingForm!: FormGroup;

  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    this.initForm();
    this.loadInitialData();
    this.setupSubscriptions();
  }

  private initForm(): void {
    this.mappingForm = this.fb.group({
      courseId: ['', [Validators.required]],
      credits: [4, [Validators.required, Validators.min(1)]],
      isMandatory: [true],
      isElective: [false],
      status: ['ACTIVE', [Validators.required]]
    });

    this.mappingForm.get('courseId')?.valueChanges.subscribe(courseId => {
      const selectedCourse = this.availableCourses.find(c => c.courseId === courseId);
      if (selectedCourse) {
        this.mappingForm.patchValue({ credits: selectedCourse.defaultCredits }, { emitEvent: false });
      }
    });
  }

  private loadInitialData(): void {
    this.academicService.getCurriculums().subscribe(data => this.curriculums = data);
    this.courseService.getCourses().subscribe(data => this.availableCourses = data);
  }

  private setupSubscriptions(): void {
    this.curriculumCtrl.valueChanges.subscribe(currId => {
      this.semesterCtrl.setValue('');
      this.mappedCourses = [];
      if (currId) {
        this.academicService.getSemesters(currId).subscribe(data => this.semesters = data);
      } else {
        this.semesters = [];
      }
    });

    this.semesterCtrl.valueChanges.subscribe(semId => {
      if (semId && this.curriculumCtrl.value) {
        this.courseService.getCurriculumCourses(this.curriculumCtrl.value, semId)
          .subscribe(data => this.mappedCourses = data);
      } else {
        this.mappedCourses = [];
      }
    });
  }

  getCourseName(courseId: string): string {
    const course = this.availableCourses.find(c => c.courseId === courseId);
    return course ? `${course.courseCode} - ${course.courseName}` : 'Unknown Course';
  }

  onMapCourse(): void {
    if (this.mappingForm.invalid || !this.curriculumCtrl.value || !this.semesterCtrl.value) return;

    const payload = {
      ...this.mappingForm.value,
      curriculumId: this.curriculumCtrl.value,
      semesterId: this.semesterCtrl.value
    };

    if (this.mappedCourses.some(m => m.courseId === payload.courseId)) {
      this.errorMessage = 'This course is already mapped to this semester.';
      this.clearMessages();
      return;
    }

    this.courseService.mapCourseToCurriculum(payload).subscribe({
      next: (res) => {
        this.mappedCourses.push(res);
        this.successMessage = 'Course mapped successfully to the curriculum semester.';
        this.mappingForm.reset({ credits: 4, isMandatory: true, isElective: false, status: 'ACTIVE', courseId: '' });
        this.clearMessages();
      },
      error: () => {
        this.errorMessage = 'Failed to map course.';
        this.clearMessages();
      }
    });
  }

  goToNextStep(): void {
    this.router.navigate(['/admin/electives']);
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
    }, 4000);
  }
}