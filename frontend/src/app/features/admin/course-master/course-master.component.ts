import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CourseStructureService } from '../../../core/services/course-structure.service';
import { CourseMaster } from '../../../core/models/course-structure.model';

@Component({
  selector: 'app-course-master',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div>
      <div class="mx-auto w-full max-w-6xl space-y-8 animate-enter">

        <!-- Header -->
        <div class="page-header">
          <div>
            <p class="page-kicker">Academic structure</p>
            <h1 class="page-title">Course catalogue</h1>
            <p class="page-subtitle">Register and manage reusable course identities across the institution.</p>
          </div>
        </div>

        <!-- Alerts -->
        <div *ngIf="successMessage" class="alert alert-success">
          <p class="text-sm text-met font-medium">{{ successMessage }}</p>
        </div>
        <div *ngIf="errorMessage" class="alert alert-error">
          <p class="text-sm text-gap font-medium">{{ errorMessage }}</p>
        </div>

        <!-- Grid Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Course List (2 Columns) -->
          <div class="card lg:col-span-2 p-6 space-y-4">
            <h3 class="section-title border-b border-line pb-3">Registered courses master</h3>
            
            <div class="overflow-x-auto">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="th">Code</th>
                    <th class="th">Course Name</th>
                    <th class="th">Type</th>
                    <th class="th">Credits</th>
                    <th class="th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let course of courses">
                    <td class="td font-medium text-ink">{{ course.courseCode }}</td>
                    <td class="td">{{ course.courseName }}</td>
                    <td class="td"><span class="chip chip-neutral">{{ course.courseType }}</span></td>
                    <td class="td">{{ course.defaultCredits }}</td>
                    <td class="td">
                      <span class="chip chip-met">{{ course.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Add Course Form (1 Column) -->
          <div class="card p-6 space-y-4">
            <h3 class="section-title border-b border-line pb-3">Add new course</h3>
            
            <form [formGroup]="courseForm" (ngSubmit)="onAddCourse()" class="space-y-4">
              <div>
                <label class="field-label">Course code *</label>
                <input type="text" formControlName="courseCode" placeholder="e.g. EC301" class="field-input">
              </div>

              <div>
                <label class="field-label">Course name *</label>
                <input type="text" formControlName="courseName" placeholder="e.g. Digital Signal Processing" class="field-input">
              </div>

              <div>
                <label class="field-label">Course type *</label>
                <select formControlName="courseType" class="field-select">
                  <option value="THEORY">Theory</option>
                  <option value="PRACTICAL">Practical</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>

              <div>
                <label class="field-label">Default credits *</label>
                <input type="number" formControlName="defaultCredits" class="field-input">
              </div>

              <div>
                <label class="field-label">Status</label>
                <select formControlName="status" class="field-select">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button type="submit" [disabled]="courseForm.invalid" class="btn btn-primary w-full">
                Save Course Master
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
            Continue to curriculum
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  `
})
export class CourseMasterComponent implements OnInit {
  private courseService = inject(CourseStructureService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  courses: CourseMaster[] = [];
  courseForm!: FormGroup;
  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    this.initForm();
    this.loadCourses();
  }

  private initForm(): void {
    this.courseForm = this.fb.group({
      institutionId: ['inst_01', [Validators.required]],
      courseCode: ['', [Validators.required]],
      courseName: ['', [Validators.required]],
      courseType: ['THEORY', [Validators.required]],
      defaultCredits: [4, [Validators.required, Validators.min(1)]],
      status: ['ACTIVE', [Validators.required]]
    });
  }

  private loadCourses(): void {
    this.courseService.getCourses().subscribe(data => this.courses = data);
  }

  onAddCourse(): void {
    if (this.courseForm.invalid) {
      this.errorMessage = 'Please fill out all required fields.';
      return;
    }

    this.courseService.createCourse(this.courseForm.value).subscribe({
      next: (res) => {
        this.courses.push(res);
        this.successMessage = `Course ${res.courseCode} registered successfully.`;
        this.courseForm.reset({ status: 'ACTIVE', defaultCredits: 4, courseType: 'THEORY', institutionId: 'inst_01' });
        setTimeout(() => this.successMessage = '', 4000);
      },
      error: () => {
        this.errorMessage = 'Failed to register course.';
        setTimeout(() => this.errorMessage = '', 4000);
      }
    });
  }

  goToNextStep(): void {
    this.router.navigate(['/admin/curriculum']);
  }
}