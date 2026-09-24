import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

interface MarksheetUploadRecord {
  id: string;
  courseName: string;
  assessmentName: string;
  fileName: string;
  uploadedAt: string;
  status: 'PENDING_REVIEW' | 'APPROVED_BY_FACULTY';
}

@Component({
  selector: 'app-lab-assistant-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-6xl mx-auto space-y-8">

        <!-- Header -->
        <div class="border-b border-slate-200 pb-5">
          <div class="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
            <span>Lab Assistant Portal</span>
            <span>•</span>
            <span>Assessment & Marks Management</span>
          </div>
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Question-wise Marksheet Upload</h1>
          <p class="text-slate-600 mt-1">Upload student marks excel sheets per assessment for faculty review and OBE attainment calculation.</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <!-- Upload Form Column -->
          <div class="lg:col-span-1">
            <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Upload New Marksheet</h3>

              <form [formGroup]="uploadForm" (ngSubmit)="onSubmit()" class="space-y-4">
                
                <!-- Course Selector -->
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Select Course</label>
                  <select formControlName="courseId" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-600">
                    <option value="CS501">CS501: Data Structures</option>
                    <option value="EC301">EC301: Digital Signal Processing</option>
                    <option value="CS602">CS602: Artificial Intelligence</option>
                  </select>
                </div>

                <!-- Assessment Type -->
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Assessment Name</label>
                  <select formControlName="assessmentName" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-600">
                    <option value="Internal Test 1">Internal Test 1</option>
                    <option value="Internal Test 2">Internal Test 2</option>
                    <option value="Assignment 1">Assignment 1</option>
                    <option value="End Semester Exam">End Semester Exam</option>
                  </select>
                </div>

                <!-- File Input -->
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Excel Marksheet (.xlsx / .csv)</label>
                  <input type="file" (change)="onFileSelected($event)" accept=".xlsx, .xls, .csv" class="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
                </div>

                <button 
                  type="submit" 
                  [disabled]="uploadForm.invalid || !selectedFile"
                  class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm mt-2">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Submit Marksheet to Faculty
                </button>
              </form>
            </div>
          </div>

          <!-- Upload History / Status Table -->
          <div class="lg:col-span-2">
            <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">
              <div class="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 class="text-base font-bold text-slate-900">Submitted Marksheets History</h3>
                  <p class="text-xs text-slate-500">Track review status from course faculty members.</p>
                </div>
                <span class="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{{ submissions.length }} Files</span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-sm whitespace-nowrap">
                  <thead class="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th class="px-4 py-3 font-semibold">Course</th>
                      <th class="px-4 py-3 font-semibold">Assessment</th>
                      <th class="px-4 py-3 font-semibold">File Name</th>
                      <th class="px-4 py-3 font-semibold">Uploaded On</th>
                      <th class="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-sm">
                    <tr *ngFor="let item of submissions" class="hover:bg-slate-50 transition-colors">
                      <td class="px-4 py-4 font-bold text-slate-900">{{ item.courseName }}</td>
                      <td class="px-4 py-4 text-slate-700">{{ item.assessmentName }}</td>
                      <td class="px-4 py-4 text-slate-600 font-mono text-xs">{{ item.fileName }}</td>
                      <td class="px-4 py-4 text-slate-500 text-xs">{{ item.uploadedAt }}</td>
                      <td class="px-4 py-4">
                        <span [ngClass]="item.status === 'APPROVED_BY_FACULTY' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
                              class="px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                          {{ item.status === 'APPROVED_BY_FACULTY' ? 'Approved by Faculty' : 'Pending Review' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class LabAssistantDashboardComponent {
  private fb = inject(FormBuilder);
  selectedFile: File | null = null;

  submissions: MarksheetUploadRecord[] = [
    { id: '1', courseName: 'CS501', assessmentName: 'Internal Test 1', fileName: 'CS501_IT1_Marks.xlsx', uploadedAt: '2026-09-24 11:30 AM', status: 'PENDING_REVIEW' },
    { id: '2', courseName: 'EC301', assessmentName: 'Assignment 1', fileName: 'EC301_Assign1_Marks.xlsx', uploadedAt: '2026-09-22 03:15 PM', status: 'APPROVED_BY_FACULTY' }
  ];

  uploadForm: FormGroup = this.fb.group({
    courseId: ['CS501', Validators.required],
    assessmentName: ['Internal Test 1', Validators.required]
  });

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  onSubmit(): void {
    if (this.uploadForm.invalid || !this.selectedFile) return;

    const newRecord: MarksheetUploadRecord = {
      id: String(this.submissions.length + 1),
      courseName: this.uploadForm.value.courseId,
      assessmentName: this.uploadForm.value.assessmentName,
      fileName: this.selectedFile.name,
      uploadedAt: new Date().toLocaleString(),
      status: 'PENDING_REVIEW'
    };

    this.submissions.unshift(newRecord);
    this.selectedFile = null;
    alert('Marksheet successfully uploaded and forwarded to Faculty for review!');
  }
}