import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CourseStructureService } from '../../../core/services/course-structure.service';
import { AcademicStructureService } from '../../../core/services/academic-structure.service';
import { CourseMaster, CurriculumCourse, CourseOffering, CourseSection } from '../../../core/models/course-structure.model';
import { AcademicYear } from '../../../core/models/academic-structure.model';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-course-offerings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div>
      <div class="mx-auto w-full max-w-7xl space-y-8 animate-enter">

        <div class="page-header">
          <div>
            <p class="page-kicker">Academic structure</p>
            <h1 class="page-title">Offerings &amp; sections</h1>
            <p class="page-subtitle">Schedule curriculum courses for specific academic years and manage sections.</p>
          </div>
        </div>

        <div *ngIf="successMessage" class="alert alert-success">
          <p class="text-sm text-met font-medium">{{ successMessage }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Left Column: Active Offerings & Sections View -->
          <div class="lg:col-span-2 space-y-6">
            <div class="card p-6">
              <label class="field-label">Filter by academic year</label>
              <select [formControl]="academicYearCtrl" class="field-select lg:w-1/2">
                <option value="">-- Select Academic Year --</option>
                <option *ngFor="let ay of academicYears" [value]="ay.academicYearId">{{ ay.yearName }}</option>
              </select>
            </div>

            <div class="card p-6" *ngIf="academicYearCtrl.value">
              <h3 class="section-title border-b border-line pb-3 mb-4">Active course offerings</h3>
              
              <div *ngIf="offerings.length === 0" class="text-sm text-ink-muted italic py-4 text-center border-2 border-dashed border-line rounded-lg">
                No courses scheduled for this academic year yet.
              </div>

              <div class="space-y-4" *ngIf="offerings.length > 0">
                <div *ngFor="let offer of offerings" class="p-4 bg-paper border border-line rounded-lg">
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <h4 class="font-bold text-ink">{{ getMappedCourseName(offer.curriculumCourseId) }}</h4>
                      <div class="text-xs text-ink-muted mt-0.5">Status: <span class="font-medium text-met">{{ offer.status }}</span></div>
                    </div>
                    <button (click)="selectOfferingForSection(offer.courseOfferingId!)" class="btn btn-outline btn-sm">
                      + Add Section
                    </button>
                  </div>
                  
                  <!-- Sections inside Offering -->
                  <div class="mt-4 pt-3 border-t border-line">
                    <h5 class="text-xs font-semibold text-ink-soft mb-2 tracking-wide">Class Sections</h5>
                    <div *ngIf="getSectionsForOffering(offer.courseOfferingId!).length === 0" class="text-xs text-ink-muted italic">
                      No sections created (Single batch assumed).
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <span *ngFor="let sec of getSectionsForOffering(offer.courseOfferingId!)" 
                            class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-surface border border-line text-ink-soft">
                        {{ sec.sectionName }} <span class="text-ink-muted ml-1">({{ sec.capacity || 'N/A' }} seats)</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Creation Forms -->
          <div class="space-y-6">
            
            <!-- Create Offering Form -->
            <div class="card p-6">
              <h3 class="section-title border-b border-line pb-3 mb-4">1. Schedule an offering</h3>
              <form [formGroup]="offeringForm" (ngSubmit)="onCreateOffering()" class="space-y-4">
                <div>
                  <label class="field-label">Target academic year *</label>
                  <select formControlName="academicYearId" class="field-select">
                    <option value="">-- Select Year --</option>
                    <option *ngFor="let ay of academicYears" [value]="ay.academicYearId">{{ ay.yearName }}</option>
                  </select>
                </div>

                <div>
                  <label class="field-label">Curriculum course to run *</label>
                  <select formControlName="curriculumCourseId" class="field-select">
                    <option value="">-- Select Mapped Course --</option>
                    <option *ngFor="let cc of allCurriculumCourses" [value]="cc.curriculumCourseId">
                      {{ getCourseName(cc.courseId) }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="field-label">Status</label>
                  <select formControlName="status" class="field-select">
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <button type="submit" [disabled]="offeringForm.invalid" class="btn btn-primary w-full">
                  Create Course Offering
                </button>
              </form>
            </div>

            <!-- Create Section Form -->
            <div class="bg-paper-deep border border-line rounded-xl p-6" *ngIf="selectedOfferingIdForSection">
              <div class="flex justify-between items-center border-b border-line pb-3 mb-4">
                <h3 class="section-title text-ink">2. Add section</h3>
                <button type="button" (click)="selectedOfferingIdForSection = null" class="text-ink-muted hover:text-ink transition-colors duration-micro">✕</button>
              </div>
              <form [formGroup]="sectionForm" (ngSubmit)="onCreateSection()" class="space-y-4">
                <div>
                  <label class="field-label">Section name *</label>
                  <input type="text" formControlName="sectionName" placeholder="e.g. Section A" class="field-input">
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="field-label">Section code *</label>
                    <input type="text" formControlName="sectionCode" placeholder="e.g. SEC-A" class="field-input">
                  </div>
                  <div>
                    <label class="field-label">Seat capacity</label>
                    <input type="number" formControlName="capacity" class="field-input">
                  </div>
                </div>

                <button type="submit" [disabled]="sectionForm.invalid" class="btn btn-primary w-full">
                  Save Section
                </button>
              </form>
            </div>

          </div>
        </div>

        <!-- Finish Module 1 & Proceed to Epic 2 Bar -->
        <div class="pt-6 border-t border-line flex justify-end">
          <button 
            type="button" 
            (click)="goToNextStep()"
            class="btn btn-primary">
            Continue to course outcomes
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  `
})
export class CourseOfferingsComponent implements OnInit {
  private courseService = inject(CourseStructureService);
  private academicService = inject(AcademicStructureService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  academicYears: AcademicYear[] = [];
  allCourses: CourseMaster[] = [];
  allCurriculumCourses: CurriculumCourse[] = [];
  
  offerings: CourseOffering[] = [];
  sections: CourseSection[] = [];

  academicYearCtrl = this.fb.control('');
  offeringForm!: FormGroup;
  sectionForm!: FormGroup;

  selectedOfferingIdForSection: string | null = null;
  successMessage = '';

  ngOnInit(): void {
    this.initForms();
    this.loadFoundationalData();
    this.setupViewSubscriptions();
  }

  private initForms(): void {
    this.offeringForm = this.fb.group({
      curriculumCourseId: ['', Validators.required],
      academicYearId: ['', Validators.required],
      status: ['ACTIVE', Validators.required]
    });

    this.sectionForm = this.fb.group({
      sectionName: ['', Validators.required],
      sectionCode: ['', Validators.required],
      capacity: [60],
      status: ['ACTIVE']
    });
  }

  private loadFoundationalData(): void {
    forkJoin({
      years: this.academicService.getAcademicYears(),
      courses: this.courseService.getCourses(),
      curriculumCourses: this.courseService.getCurriculumCourses('curr_01')
    }).subscribe(res => {
      this.academicYears = res.years;
      this.allCourses = res.courses;
      this.allCurriculumCourses = res.curriculumCourses;
    });
  }

  private setupViewSubscriptions(): void {
    this.academicYearCtrl.valueChanges.subscribe(ayId => {
      this.offerings = [];
      this.sections = [];
      this.selectedOfferingIdForSection = null;
      if (ayId) {
        this.loadOfferingsAndSections(ayId);
        this.offeringForm.patchValue({ academicYearId: ayId });
      }
    });
  }

  private loadOfferingsAndSections(academicYearId: string): void {
    this.courseService.getCourseOfferings(academicYearId).subscribe(offerData => {
      this.offerings = offerData;
      this.offerings.forEach(off => {
        this.courseService.getCourseSections(off.courseOfferingId!).subscribe(secData => {
          this.sections = [...this.sections, ...secData];
        });
      });
    });
  }

  getCourseName(courseId: string): string {
    const course = this.allCourses.find(c => c.courseId === courseId);
    return course ? `${course.courseCode}: ${course.courseName}` : 'Unknown Course';
  }

  getMappedCourseName(curriculumCourseId: string): string {
    const cc = this.allCurriculumCourses.find(c => c.curriculumCourseId === curriculumCourseId);
    return cc ? this.getCourseName(cc.courseId) : 'Unknown Mapped Course';
  }

  getSectionsForOffering(offeringId: string): CourseSection[] {
    return this.sections.filter(s => s.courseOfferingId === offeringId);
  }

  onCreateOffering(): void {
    if (this.offeringForm.invalid) return;
    
    this.courseService.createCourseOffering(this.offeringForm.value).subscribe(res => {
      if (res.academicYearId === this.academicYearCtrl.value) {
        this.offerings.push(res);
      }
      this.showSuccess('Course Offering scheduled successfully.');
      this.offeringForm.reset({ status: 'ACTIVE', academicYearId: this.academicYearCtrl.value });
    });
  }

  selectOfferingForSection(offeringId: string): void {
    this.selectedOfferingIdForSection = offeringId;
    this.sectionForm.reset({ capacity: 60, status: 'ACTIVE' });
  }

  onCreateSection(): void {
    if (this.sectionForm.invalid || !this.selectedOfferingIdForSection) return;

    const payload: Omit<CourseSection, 'courseSectionId'> = {
      ...this.sectionForm.value,
      courseOfferingId: this.selectedOfferingIdForSection
    };

    this.courseService.createCourseSection(payload).subscribe(res => {
      this.sections.push(res);
      this.showSuccess(`Section ${res.sectionName} added successfully.`);
      this.sectionForm.reset({ capacity: 60, status: 'ACTIVE' });
      this.selectedOfferingIdForSection = null;
    });
  }

  goToNextStep(): void {
    this.router.navigate(['/admin/course-master']);
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 4000);
  }
}