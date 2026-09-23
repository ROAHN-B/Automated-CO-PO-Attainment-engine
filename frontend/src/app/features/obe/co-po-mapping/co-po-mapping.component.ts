import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CourseObeService } from '../../../core/services/course-obe.service';
import { 
  CourseOutcomeEntity, 
  ProgramOutcome, 
  ProgramSpecificOutcome,
  CoPoMapping,
  CoPsoMapping
} from '../../../core/models/epic2-course-obe.model';

@Component({
  selector: 'app-co-po-mapping',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-7xl mx-auto space-y-6">

        <!-- Header Section -->
        <div class="flex justify-between items-end">
          <div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">CO-PO/PSO Correlation Matrix</h1>
            <p class="text-slate-600 mt-1">Define mapping levels (1 = Low, 2 = Medium, 3 = High) for the selected course.</p>
          </div>
          <button 
            (click)="saveMatrix()" 
            [disabled]="isSaving"
            class="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2">
            <span *ngIf="!isSaving">Save Correlation Matrix</span>
            <span *ngIf="isSaving">Saving...</span>
          </button>
        </div>

        <!-- Success Message -->
        <div *ngIf="successMessage" class="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg shadow-sm animate-fade-in-down">
          <p class="text-sm text-emerald-700 font-medium flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            {{ successMessage }}
          </p>
        </div>

        <!-- Matrix Container -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-max">
              <!-- Top Header Grouping -->
              <thead>
                <tr class="bg-slate-100 border-b border-slate-200">
                  <th class="px-4 py-3 font-bold text-slate-800 border-r border-slate-200 bg-slate-50 sticky left-0 z-10 w-48 shadow-[1px_0_0_0_#e2e8f0]">
                    Course Outcomes
                  </th>
                  <th [attr.colspan]="pos.length" class="px-4 py-2 font-bold text-slate-800 text-center border-r border-slate-200 bg-indigo-50/50">
                    Program Outcomes (POs)
                  </th>
                  <th [attr.colspan]="psos.length" class="px-4 py-2 font-bold text-slate-800 text-center bg-emerald-50/50">
                    Program Specific Outcomes (PSOs)
                  </th>
                </tr>
                <!-- Sub Header (Specific PO/PSO Codes) -->
                <tr class="bg-slate-50 border-b border-slate-200 text-xs">
                  <th class="px-4 py-2 text-slate-500 border-r border-slate-200 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                    (Hover over codes for details)
                  </th>
                  <th *ngFor="let po of pos" 
                      class="px-2 py-3 font-semibold text-slate-700 text-center border-r border-slate-200 cursor-help"
                      [title]="po.poStatement">
                    {{ po.poCode }}
                  </th>
                  <th *ngFor="let pso of psos" 
                      class="px-2 py-3 font-semibold text-slate-700 text-center border-r border-slate-200 cursor-help"
                      [title]="pso.psoStatement">
                    {{ pso.psoCode }}
                  </th>
                </tr>
              </thead>

              <!-- Matrix Body -->
              <tbody class="divide-y divide-slate-100">
                <tr *ngFor="let co of cos" class="hover:bg-slate-50/50 transition-colors">
                  
                  <!-- CO Column (Sticky) -->
                  <td class="px-4 py-3 border-r border-slate-200 bg-white sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] group">
                    <div class="font-bold text-slate-800">{{ co.coCode }}</div>
                    <div class="text-[10px] text-slate-500 line-clamp-2 mt-0.5 group-hover:line-clamp-none transition-all" [title]="co.coStatement">
                      {{ co.coStatement }}
                    </div>
                  </td>

                  <!-- PO Mapping Cells -->
                  <td *ngFor="let po of pos" class="p-2 border-r border-slate-200 align-middle">
                    <select 
                      [(ngModel)]="poMatrix[getMatrixKey(co.coId!, po.poId!)]"
                      class="w-full text-center px-1 py-1.5 text-sm font-semibold rounded outline-none transition-colors appearance-none cursor-pointer"
                      [ngClass]="{
                        'bg-slate-100 text-slate-400 hover:bg-slate-200': poMatrix[getMatrixKey(co.coId!, po.poId!)] === null,
                        'bg-indigo-100 text-indigo-700 border-indigo-200': poMatrix[getMatrixKey(co.coId!, po.poId!)] === 1,
                        'bg-indigo-200 text-indigo-800 border-indigo-300': poMatrix[getMatrixKey(co.coId!, po.poId!)] === 2,
                        'bg-indigo-600 text-white border-indigo-700': poMatrix[getMatrixKey(co.coId!, po.poId!)] === 3
                      }">
                      <option [ngValue]="null">-</option>
                      <option [ngValue]="1">1</option>
                      <option [ngValue]="2">2</option>
                      <option [ngValue]="3">3</option>
                    </select>
                  </td>

                  <!-- PSO Mapping Cells -->
                  <td *ngFor="let pso of psos" class="p-2 border-r border-slate-200 align-middle">
                    <select 
                      [(ngModel)]="psoMatrix[getMatrixKey(co.coId!, pso.psoId!)]"
                      class="w-full text-center px-1 py-1.5 text-sm font-semibold rounded outline-none transition-colors appearance-none cursor-pointer"
                      [ngClass]="{
                        'bg-slate-100 text-slate-400 hover:bg-slate-200': psoMatrix[getMatrixKey(co.coId!, pso.psoId!)] === null,
                        'bg-emerald-100 text-emerald-700 border-emerald-200': psoMatrix[getMatrixKey(co.coId!, pso.psoId!)] === 1,
                        'bg-emerald-200 text-emerald-800 border-emerald-300': psoMatrix[getMatrixKey(co.coId!, pso.psoId!)] === 2,
                        'bg-emerald-600 text-white border-emerald-700': psoMatrix[getMatrixKey(co.coId!, pso.psoId!)] === 3
                      }">
                      <option [ngValue]="null">-</option>
                      <option [ngValue]="1">1</option>
                      <option [ngValue]="2">2</option>
                      <option [ngValue]="3">3</option>
                    </select>
                  </td>

                </tr>
                
                <tr *ngIf="cos.length === 0">
                  <td [attr.colspan]="1 + pos.length + psos.length" class="px-6 py-8 text-center text-slate-500 italic">
                    No Course Outcomes found for this course. Please define COs first.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  `
})
export class CoPoMappingComponent implements OnInit {
  private obeService = inject(CourseObeService);

  // Hardcoded for Epic 2 prototype. In real app, this comes from Route Params or a Dropdown.
  currentCourseId = 'crs_01'; 
  currentProgramId = 'prog_01'; 

  cos: CourseOutcomeEntity[] = [];
  pos: ProgramOutcome[] = [];
  psos: ProgramSpecificOutcome[] = [];

  // Dictionaries to hold the correlation values. Key: "coId_poId", Value: 1, 2, 3, or null
  poMatrix: { [key: string]: 1 | 2 | 3 | null } = {};
  psoMatrix: { [key: string]: 1 | 2 | 3 | null } = {};

  isSaving = false;
  successMessage = '';

  ngOnInit(): void {
    this.loadMasterData();
  }

  private loadMasterData(): void {
    // Load COs
    this.obeService.getCourseOutcomes(this.currentCourseId).subscribe(data => {
      this.cos = data;
      this.initializeMatrixKeys();
      this.loadExistingMappings();
    });

    // Load POs
    this.obeService.getProgramOutcomes().subscribe(data => {
      this.pos = data;
      this.initializeMatrixKeys();
    });

    // Load PSOs
    this.obeService.getProgramSpecificOutcomes(this.currentProgramId).subscribe(data => {
      this.psos = data;
      this.initializeMatrixKeys();
    });
  }

  // Ensures every cell has at least a 'null' value so the dropdowns bind correctly
  private initializeMatrixKeys(): void {
    if (!this.cos.length) return;

    this.cos.forEach(co => {
      this.pos.forEach(po => {
        const key = this.getMatrixKey(co.coId!, po.poId!);
        if (this.poMatrix[key] === undefined) this.poMatrix[key] = null;
      });
      
      this.psos.forEach(pso => {
        const key = this.getMatrixKey(co.coId!, pso.psoId!);
        if (this.psoMatrix[key] === undefined) this.psoMatrix[key] = null;
      });
    });
  }

  private loadExistingMappings(): void {
    this.obeService.getCoPoMappings(this.currentCourseId).subscribe(mappings => {
      mappings.forEach(m => {
        this.poMatrix[this.getMatrixKey(m.coId, m.poId)] = m.correlationLevel;
      });
    });

    this.obeService.getCoPsoMappings(this.currentCourseId).subscribe(mappings => {
      mappings.forEach(m => {
        this.psoMatrix[this.getMatrixKey(m.coId, m.psoId)] = m.correlationLevel;
      });
    });
  }

  getMatrixKey(coId: string, targetId: string): string {
    return `${coId}_${targetId}`;
  }

  saveMatrix(): void {
    this.isSaving = true;

    // Convert dictionaries back to arrays of mapping objects
    const poMappingsToSave: CoPoMapping[] = [];
    const psoMappingsToSave: CoPsoMapping[] = [];

    this.cos.forEach(co => {
      // Collect POs
      this.pos.forEach(po => {
        const val = this.poMatrix[this.getMatrixKey(co.coId!, po.poId!)];
        if (val !== null) {
          poMappingsToSave.push({ courseId: this.currentCourseId, coId: co.coId!, poId: po.poId!, correlationLevel: val });
        }
      });
      // Collect PSOs
      this.psos.forEach(pso => {
        const val = this.psoMatrix[this.getMatrixKey(co.coId!, pso.psoId!)];
        if (val !== null) {
          psoMappingsToSave.push({ courseId: this.currentCourseId, coId: co.coId!, psoId: pso.psoId!, correlationLevel: val });
        }
      });
    });

    // Save both arrays (in a real app you'd use forkJoin here)
    this.obeService.saveCoPoMappings(poMappingsToSave).subscribe(() => {
      this.obeService.saveCoPsoMappings(psoMappingsToSave).subscribe(() => {
        this.isSaving = false;
        this.successMessage = 'Correlation matrix saved successfully!';
        setTimeout(() => this.successMessage = '', 4000);
      });
    });
  }
}