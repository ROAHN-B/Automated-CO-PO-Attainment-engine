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
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-6xl mx-auto space-y-8">

        <!-- Header -->
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Course Master Management</h1>
            <p class="text-slate-600 mt-1">Register and manage reusable course identities across the institution.</p>
          </div>
        </div>

        <!-- Alerts -->
        <div *ngIf="successMessage" class="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
          <p class="text-sm text-emerald-700 font-medium">{{ successMessage }}</p>
        </div>
        <div *ngIf="errorMessage" class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <p class="text-sm text-red-700 font-medium">{{ errorMessage }}</p>
        </div>

        <!-- Grid Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Course List (2 Columns) -->
          <div class="lg:col-span-2 bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">Registered Courses Master</h3>
            
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm text-slate-600">
                <thead class="bg-slate-100 text-slate-700 uppercase text-xs">
                  <tr>
                    <th class="p-3">Code</th>
                    <th class="p-3">Course Name</th>
                    <th class="p-3">Type</th>
                    <th class="p-3">Credits</th>
                    <th class="p-3">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr *ngFor="let course of courses" class="hover:bg-slate-50">
                    <td class="p-3 font-semibold text-slate-900">{{ course.courseCode }}</td>
                    <td class="p-3">{{ course.courseName }}</td>
                    <td class="p-3"><span class="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">{{ course.courseType }}</span></td>
                    <td class="p-3">{{ course.defaultCredits }}</td>
                    <td class="p-3">
                      <span class="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full font-medium">{{ course.status }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Add Course Form (1 Column) -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3">Add New Course</h3>
            
            <form [formGroup]="courseForm" (ngSubmit)="onAddCourse()" class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Course Code *</label>
                <input type="text" formControlName="courseCode" placeholder="e.g. EC301" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Course Name *</label>
                <input type="text" formControlName="courseName" placeholder="e.g. Digital Signal Processing" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Course Type *</label>
                <select formControlName="courseType" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="THEORY">Theory</option>
                  <option value="PRACTICAL">Practical</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Default Credits *</label>
                <input type="number" formControlName="defaultCredits" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select formControlName="status" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button type="submit" [disabled]="courseForm.invalid" class="w-full py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors">
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
            class="px-6 py-3 bg-slate-900 text-white font-semibold text-sm rounded-lg shadow hover:bg-slate-800 transition flex items-center gap-2">
            Proceed to Curriculum Mapping 
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
    this.router.navigate(['/admin/curriculum-mapping']);
  }
}