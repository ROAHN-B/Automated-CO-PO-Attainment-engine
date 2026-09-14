import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AcademicStructureService } from '../../../core/services/academic-structure.service';
import { CourseStructureService } from '../../../core/services/course-structure.service';
import { Curriculum, Semester } from '../../../core/models/academic-structure.model';
import { ElectiveGroup } from '../../../core/models/course-structure.model';

@Component({
  selector: 'app-elective-groups',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-7xl mx-auto space-y-8">

        <!-- Header -->
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Elective Baskets Configuration</h1>
            <p class="text-slate-600 mt-1">Create elective groups and define student selection rules for semesters.</p>
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
          
          <!-- Left Column: Context & Existing Groups -->
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

            <!-- Elective Groups List -->
            <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6" *ngIf="semesterCtrl.value">
              <h3 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">Elective Baskets for Semester</h3>
              
              <div *ngIf="electiveGroups.length === 0" class="text-sm text-slate-500 italic py-4 text-center border-2 border-dashed border-slate-200 rounded-lg">
                No elective baskets configured for this semester.
              </div>

              <div class="space-y-4" *ngIf="electiveGroups.length > 0">
                <div *ngFor="let group of electiveGroups" class="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <h4 class="font-bold text-slate-900">{{ group.groupName }}</h4>
                      <span class="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded"
                            [ngClass]="group.groupType === 'PE' ? 'bg-indigo-100 text-indigo-700' : 'bg-fuchsia-100 text-fuchsia-700'">
                        {{ group.groupType === 'PE' ? 'Professional Elective' : 'Open Elective' }}
                      </span>
                    </div>
                    <span class="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full font-medium">{{ group.status }}</span>
                  </div>
                  <div class="flex gap-4 mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
                    <div><span class="font-medium text-slate-900">Min Select:</span> {{ group.minSelection }}</div>
                    <div><span class="font-medium text-slate-900">Max Select:</span> {{ group.maxSelection }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Create Group Form -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 h-fit sticky top-6">
            <h3 class="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4">Create Elective Basket</h3>
            
            <form [formGroup]="groupForm" (ngSubmit)="onCreateGroup()" class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Basket Name *</label>
                <input type="text" formControlName="groupName" placeholder="e.g. Professional Elective - I" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Group Type *</label>
                <select formControlName="groupType" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="PE">Professional Elective (PE)</option>
                  <option value="OE">Open Elective (OE)</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Min Selection *</label>
                  <input type="number" formControlName="minSelection" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Max Selection *</label>
                  <input type="number" formControlName="maxSelection" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select formControlName="status" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button type="submit" [disabled]="groupForm.invalid || !semesterCtrl.value" class="w-full py-2 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors">
                Save Elective Basket
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
            Proceed to Course Offerings & Sections 
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  `
})
export class ElectiveGroupsComponent implements OnInit {
  private academicService = inject(AcademicStructureService);
  private courseService = inject(CourseStructureService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  curriculums: Curriculum[] = [];
  semesters: Semester[] = [];
  electiveGroups: ElectiveGroup[] = [];

  curriculumCtrl = this.fb.control('');
  semesterCtrl = this.fb.control('');
  groupForm!: FormGroup;

  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    this.initForm();
    this.loadCurriculums();
    this.setupSubscriptions();
  }

  private initForm(): void {
    this.groupForm = this.fb.group({
      groupName: ['', [Validators.required]],
      groupType: ['PE', [Validators.required]],
      minSelection: [1, [Validators.required, Validators.min(0)]],
      maxSelection: [1, [Validators.required, Validators.min(1)]],
      status: ['ACTIVE', [Validators.required]]
    });
  }

  private loadCurriculums(): void {
    this.academicService.getCurriculums().subscribe(data => this.curriculums = data);
  }

  private setupSubscriptions(): void {
    this.curriculumCtrl.valueChanges.subscribe(currId => {
      this.semesterCtrl.setValue('');
      this.electiveGroups = [];
      if (currId) {
        this.academicService.getSemesters(currId).subscribe(data => this.semesters = data);
      } else {
        this.semesters = [];
      }
    });

    this.semesterCtrl.valueChanges.subscribe(semId => {
      if (semId) {
        this.loadElectiveGroups(semId);
      } else {
        this.electiveGroups = [];
      }
    });
  }

  private loadElectiveGroups(semesterId: string): void {
    this.courseService.getElectiveGroups(semesterId).subscribe(data => this.electiveGroups = data);
  }

  onCreateGroup(): void {
    if (this.groupForm.invalid || !this.semesterCtrl.value) return;

    const { minSelection, maxSelection } = this.groupForm.value;
    if (minSelection > maxSelection) {
      this.errorMessage = 'Min selection cannot be greater than Max selection.';
      this.clearMessages();
      return;
    }

    const payload = {
      ...this.groupForm.value,
      semesterId: this.semesterCtrl.value
    };

    this.courseService.createElectiveGroup(payload).subscribe({
      next: (res) => {
        this.electiveGroups.push(res);
        this.successMessage = 'Elective basket created successfully.';
        this.groupForm.reset({ groupType: 'PE', minSelection: 1, maxSelection: 1, status: 'ACTIVE' });
        this.clearMessages();
      },
      error: () => {
        this.errorMessage = 'Failed to create elective basket.';
        this.clearMessages();
      }
    });
  }

  goToNextStep(): void {
    this.router.navigate(['/admin/course-offerings']);
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
    }, 4000);
  }
}