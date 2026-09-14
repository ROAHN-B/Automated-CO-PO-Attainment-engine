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
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-7xl mx-auto space-y-8">

        <!-- Header -->
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Curriculum Mapping</h1>
            <p class="text-slate-600 mt-1">Map courses to specific curriculum semesters and define credit rules.</p>
          </div>
        </div>

        <!-- Alerts -->
        <div *ngIf="successMessage" class="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
          <p class="text-sm text-emerald-700 font-medium">{{ successMessage }}</p>
        </div>
        <div *ngIf="errorMessage" class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <p class="text-sm text-red-700 font-medium">{{ errorMessage }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Left Column: Context Selection & Mapped Courses -->
          <div class="lg:col-span-2 space-y-6">
            
            <!-- Context Selectors -->
            <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex gap-4">
              <div class="flex-1">
                <label class="block text-xs font-medium text-slate-600 mb-1">Select Curriculum</label>
                <select [formControl]="curriculumCtrl" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="">-- Select Curriculum --</option>
                  <option *ngFor="let curr of curriculums" [value]="curr.curriculumId">Curriculum {{ curr.curriculumYear }}</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="block text-xs font-medium text-slate-600 mb-1">Select Semester</label>
                <select [formControl]="semesterCtrl" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" [disabled]="!curriculumCtrl.value">
                  <option value="">-- Select Semester --</option>
                  <option *ngFor="let sem of semesters" [value]="sem.semesterId">{{ sem.semesterName }}</option>
                </select>
              </div>
            </div>

            <!-- Mapped Courses List -->
            <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6" *ngIf="semesterCtrl.value">
              <h3 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">Mapped Courses for Semester</h3>
              
              <div *ngIf="mappedCourses.length === 0" class="text-sm text-slate-500 italic py-4 text-center border-2 border-dashed border-slate-200 rounded-lg">
                No courses mapped to this semester yet.
              </div>

              <div class="space-y-3" *ngIf="mappedCourses.length > 0">
                <div *ngFor="let mapping of mappedCourses" class="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div>
                    <span class="font-semibold text-slate-800">{{ getCourseName(mapping.courseId) }}</span>
                    <div class="text-xs text-slate-500 mt-0.5 space-x-2">
                      <span>Credits: {{ mapping.credits }}</span>
                      <span *ngIf="mapping.isElective" class="text-amber-600 font-medium">• Elective</span>
                      <span *ngIf="mapping.isMandatory" class="text-blue-600 font-medium">• Mandatory</span>
                    </div>
                  </div>
                  <span class="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full font-medium">{{ mapping.status }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Mapping Form -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 h-fit sticky top-6">
            <h3 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">Map New Course</h3>
            
            <form [formGroup]="mappingForm" (ngSubmit)="onMapCourse()" class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Select Course Master *</label>
                <select formControlName="courseId" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="">-- Select Course --</option>
                  <option *ngFor="let course of availableCourses" [value]="course.courseId">
                    {{ course.courseCode }} - {{ course.courseName }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Curriculum Credits *</label>
                <input type="number" formControlName="credits" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                <p class="text-[10px] text-slate-400 mt-1">Can override the master course default.</p>
              </div>

              <div class="flex items-center gap-2 pt-2">
                <input type="checkbox" formControlName="isMandatory" id="isMandatory" class="rounded border-slate-300 text-slate-900 focus:ring-slate-900">
                <label for="isMandatory" class="text-sm font-medium text-slate-700">Is Mandatory?</label>
              </div>

              <div class="flex items-center gap-2 pb-2">
                <input type="checkbox" formControlName="isElective" id="isElective" class="rounded border-slate-300 text-slate-900 focus:ring-slate-900">
                <label for="isElective" class="text-sm font-medium text-slate-700">Is Elective?</label>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select formControlName="status" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button type="submit" [disabled]="mappingForm.invalid || !semesterCtrl.value" class="w-full py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors">
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
            class="px-6 py-3 bg-slate-900 text-white font-semibold text-sm rounded-lg shadow hover:bg-slate-800 transition flex items-center gap-2">
            Proceed to Elective Baskets Configuration 
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
    this.router.navigate(['/admin/elective-groups']);
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
    }, 4000);
  }
}