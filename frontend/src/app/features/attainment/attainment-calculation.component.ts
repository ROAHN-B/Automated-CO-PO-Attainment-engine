import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AttainmentService } from '../../core/services/attainment.service';
import { CoAttainmentRecord } from '../../core/models/attainment.model';

@Component({
  selector: 'app-attainment-calculation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-6xl mx-auto space-y-8">

        <!-- Header -->
        <div class="border-b border-slate-200 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div class="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
              <span>Faculty Dashboard</span>
              <span>•</span>
              <span>CO-PO Attainment Calculation</span>
            </div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Outcome Attainment & Matrix Engine</h1>
            <p class="text-slate-600 mt-1">Review lab assistant marksheets, run attainment calculations, and export accreditation matrices.</p>
          </div>
          
          <div class="flex items-center gap-3">
            <button 
              (click)="openMarksheetModal = true"
              class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Review Lab Marksheets
            </button>

            <button 
              (click)="recalculateAttainment()"
              class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Run Calculation Engine
            </button>
          </div>
        </div>

        <!-- Pending Marksheet Alert Card -->
        <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              
            </div>
            <div>
              <h4 class="text-sm font-bold text-indigo-900">Lab Marksheet Available for Internal Test 1</h4>
              <p class="text-xs text-indigo-700 mt-0.5">Uploaded by Lab Assistant (CS501_IT1_Marks.xlsx). Ready for OBE processing.</p>
            </div>
          </div>
          <button (click)="importAndProcess()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">
            Import & Calculate
          </button>
        </div>

        <!-- Attainment Breakdown Table -->
        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 class="text-sm font-bold text-slate-800">Course Outcome (CO) Attainment Summary</h3>
            <span class="text-xs font-medium text-slate-500">Course: Data Structures (CS501)</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm whitespace-nowrap">
              <thead class="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th class="px-6 py-3 font-semibold">Course Outcome</th>
                  <th class="px-6 py-3 font-semibold">Direct Attainment (80%)</th>
                  <th class="px-6 py-3 font-semibold">Indirect Attainment (20%)</th>
                  <th class="px-6 py-3 font-semibold">Final Attainment (%)</th>
                  <th class="px-6 py-3 font-semibold">Attainment Level</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                <tr *ngFor="let record of attainmentRecords" class="hover:bg-slate-50 transition-colors">
                  <td class="px-6 py-4 font-bold text-slate-900">{{ record.coId }}: <span class="font-normal text-slate-600">{{ record.description }}</span></td>
                  <td class="px-6 py-4 font-semibold text-slate-700">{{ record.directScore }}%</td>
                  <td class="px-6 py-4 font-semibold text-slate-700">{{ record.indirectScore }}%</td>
                  <td class="px-6 py-4 font-black text-emerald-600">{{ record.finalScore }}%</td>
                  <td class="px-6 py-4">
                    <span class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                      Level {{ record.level }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Download Matrix Section -->
        <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 class="text-base font-bold text-slate-900">Final CO-PO Attainment Matrix Ready</h3>
            <p class="text-xs text-slate-500 mt-1">Export the complete NBA correlation matrix and attainment report for submission.</p>
          </div>
          <div class="flex items-center gap-3 w-full md:w-auto">
            <button (click)="downloadMatrix('excel')" class="flex-1 md:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2">
              Download Excel Matrix
            </button>
            <button (click)="downloadMatrix('pdf')" class="flex-1 md:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2">
              Download PDF Report
            </button>
          </div>
        </div>

      </div>
    </div>

    <!-- Modal for Reviewing Lab Marksheets -->
    <div *ngIf="openMarksheetModal" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-xl">
        <div class="flex justify-between items-center border-b border-slate-100 pb-4">
          <h3 class="text-lg font-bold text-slate-900">Lab Assistant Marksheet Submissions</h3>
          <button (click)="openMarksheetModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <div class="space-y-3">
          <div class="border border-slate-200 rounded-xl p-4 flex items-center justify-between bg-slate-50">
            <div>
              <p class="text-sm font-bold text-slate-800">CS501_IT1_Marks.xlsx</p>
              <p class="text-xs text-slate-500">Uploaded by Lab Assistant on 24 Sep 2026 • 72 Students</p>
            </div>
            <div class="flex items-center gap-2">
              <button (click)="importAndProcess()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg">Approve & Process</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AttainmentCalculationComponent implements OnInit {
  private attainmentService = inject(AttainmentService);
  openMarksheetModal = false;

  attainmentRecords: CoAttainmentRecord[] = [
    { coId: 'CO1', description: 'Apply appropriate data structures to solve computational problems', directScore: 78.5, indirectScore: 82.0, finalScore: 79.2, level: 3 },
    { coId: 'CO2', description: 'Design efficient sorting and searching algorithms', directScore: 71.2, indirectScore: 75.0, finalScore: 72.0, level: 3 },
    { coId: 'CO3', description: 'Analyze asymptotic runtime complexities of algorithms', directScore: 64.0, indirectScore: 70.0, finalScore: 65.2, level: 2 },
    { coId: 'CO4', description: 'Implement non-linear tree and graph data structures', directScore: 82.5, indirectScore: 85.0, finalScore: 83.0, level: 3 }
  ];

  ngOnInit(): void {}

  importAndProcess(): void {
    this.openMarksheetModal = false;
    alert('Lab Marksheet imported successfully! Backend CO-PO attainment engine triggered.');
  }

  recalculateAttainment(): void {
    this.attainmentService.triggerRecalculation('crs_01').subscribe(() => {
      alert('Attainment engine recalculated successfully.');
    });
  }

  downloadMatrix(format: 'excel' | 'pdf'): void {
    alert(`Downloading final CO-PO attainment matrix as ${format.toUpperCase()}...`);
  }
}