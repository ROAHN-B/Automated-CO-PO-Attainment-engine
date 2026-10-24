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
    <div>
      <div class="mx-auto w-full max-w-7xl space-y-8 animate-enter">

        <!-- Header -->
        <div class="page-header">
          <div>
            <p class="page-kicker">Academic structure</p>
            <h1 class="page-title">Elective groups</h1>
            <p class="page-subtitle">Create elective groups and define student selection rules for semesters.</p>
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
          
          <!-- Left Column: Context & Existing Groups -->
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

            <!-- Elective Groups List -->
            <div class="card p-6" *ngIf="semesterCtrl.value">
              <h3 class="section-title border-b border-line pb-3 mb-4">Elective baskets for semester</h3>
              
              <div *ngIf="electiveGroups.length === 0" class="text-sm text-ink-muted italic py-4 text-center border-2 border-dashed border-line rounded-lg">
                No elective baskets configured for this semester.
              </div>

              <div class="space-y-4" *ngIf="electiveGroups.length > 0">
                <div *ngFor="let group of electiveGroups" class="p-4 bg-paper border border-line rounded-lg">
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <h4 class="font-bold text-ink">{{ group.groupName }}</h4>
                      <span class="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded"
                            [ngClass]="group.groupType === 'PE' ? 'bg-brand-50 text-brand-700' : 'bg-fuchsia-100 text-fuchsia-700'">
                        {{ group.groupType === 'PE' ? 'Professional Elective' : 'Open Elective' }}
                      </span>
                    </div>
                    <span class="chip chip-met">{{ group.status }}</span>
                  </div>
                  <div class="flex gap-4 mt-3 pt-3 border-t border-line text-xs text-ink-soft">
                    <div><span class="font-medium text-ink">Min Select:</span> {{ group.minSelection }}</div>
                    <div><span class="font-medium text-ink">Max Select:</span> {{ group.maxSelection }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Create Group Form -->
          <div class="card p-6 h-fit sticky top-6">
            <h3 class="section-title border-b border-line pb-3 mb-4">Create elective basket</h3>
            
            <form [formGroup]="groupForm" (ngSubmit)="onCreateGroup()" class="space-y-4">
              <div>
                <label class="field-label">Basket name *</label>
                <input type="text" formControlName="groupName" placeholder="e.g. Professional Elective - I" class="field-input">
              </div>

              <div>
                <label class="field-label">Group type *</label>
                <select formControlName="groupType" class="field-select">
                  <option value="PE">Professional Elective (PE)</option>
                  <option value="OE">Open Elective (OE)</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="field-label">Min selection *</label>
                  <input type="number" formControlName="minSelection" class="field-input">
                </div>
                <div>
                  <label class="field-label">Max selection *</label>
                  <input type="number" formControlName="maxSelection" class="field-input">
                </div>
              </div>

              <div>
                <label class="field-label">Status</label>
                <select formControlName="status" class="field-select">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <button type="submit" [disabled]="groupForm.invalid || !semesterCtrl.value" class="btn btn-primary w-full">
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
            class="btn btn-primary">
            Continue to course offerings
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
    this.router.navigate(['/admin/offerings']);
  }

  private clearMessages(): void {
    setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
    }, 4000);
  }
}