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
    <div>
      <div class="mx-auto w-full max-w-7xl space-y-8 animate-enter">

        <!-- Header Section -->
        <div class="page-header">
          <div>
            <p class="page-kicker">Outcomes</p>
            <h1 class="page-title">CO-PO mapping</h1>
            <p class="page-subtitle">Define mapping levels (1 = Low, 2 = Medium, 3 = High) for the selected course.</p>
          </div>
          <button 
            (click)="saveMatrix()" 
            [disabled]="isSaving"
            class="btn btn-primary">
            <span *ngIf="!isSaving">Save Correlation Matrix</span>
            <span *ngIf="isSaving">Saving...</span>
          </button>
        </div>

        <!-- Success Message -->
        <div *ngIf="successMessage" class="alert alert-success">
          <p class="text-sm text-met font-medium flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            {{ successMessage }}
          </p>
        </div>

        <!-- Matrix Container -->
        <div class="card overflow-hidden flex flex-col">
          
          <div class="overflow-x-auto">
            <table class="data-table">
              <!-- Top Header Grouping -->
              <thead>
                <tr>
                  <th class="th sticky left-0 z-10 w-48">
                    Course Outcomes
                  </th>
                  <th [attr.colspan]="pos.length" class="th text-center">
                    Program Outcomes (POs)
                  </th>
                  <th [attr.colspan]="psos.length" class="th text-center">
                    Program Specific Outcomes (PSOs)
                  </th>
                </tr>
                <!-- Sub Header (Specific PO/PSO Codes) -->
                <tr>
                  <th class="th sticky left-0 z-10">
                    (Hover over codes for details)
                  </th>
                  <th *ngFor="let po of pos" 
                      class="th text-center"
                      [title]="po.poStatement">
                    {{ po.poCode }}
                  </th>
                  <th *ngFor="let pso of psos" 
                      class="th text-center"
                      [title]="pso.psoStatement">
                    {{ pso.psoCode }}
                  </th>
                </tr>
              </thead>

              <!-- Matrix Body -->
              <tbody>
                <tr *ngFor="let co of cos">
                  
                  <!-- CO Column (Sticky) -->
                  <td class="td sticky left-0 z-10 min-w-[220px] bg-surface">
                    <div class="font-bold text-ink">{{ co.coCode }}</div>
                    <div class="text-[10px] text-ink-muted line-clamp-2 mt-0.5 group-hover:line-clamp-none transition-all" [title]="co.coStatement">
                      {{ co.coStatement }}
                    </div>
                  </td>

                  <!-- PO Mapping Cells -->
                  <td *ngFor="let po of pos" class="td px-2 text-center">
                    <select 
                      [(ngModel)]="poMatrix[getMatrixKey(co.coId!, po.poId!)]"
                      class="h-9 w-14 cursor-pointer appearance-none rounded-md border text-center text-sm font-medium tnum transition-colors duration-micro focus:border-brand focus:shadow-focus focus:outline-none"
                      [ngClass]="{
                        'border-line bg-paper text-ink-faint hover:border-ink/20': poMatrix[getMatrixKey(co.coId!, po.poId!)] === null,
                        'border-brand-100 bg-brand-50 text-brand-700': poMatrix[getMatrixKey(co.coId!, po.poId!)] === 1,
                        'border-brand-200 bg-brand-100 text-brand-800': poMatrix[getMatrixKey(co.coId!, po.poId!)] === 2,
                        'border-brand bg-brand text-white': poMatrix[getMatrixKey(co.coId!, po.poId!)] === 3
                      }" [attr.aria-label]="co.coCode + ' to ' + po.poCode + ' correlation'">
                      <option [ngValue]="null">-</option>
                      <option [ngValue]="1">1</option>
                      <option [ngValue]="2">2</option>
                      <option [ngValue]="3">3</option>
                    </select>
                  </td>

                  <!-- PSO Mapping Cells -->
                  <td *ngFor="let pso of psos" class="td px-2 text-center">
                    <select 
                      [(ngModel)]="psoMatrix[getMatrixKey(co.coId!, pso.psoId!)]"
                      class="h-9 w-14 cursor-pointer appearance-none rounded-md border text-center text-sm font-medium tnum transition-colors duration-micro focus:border-brand focus:shadow-focus focus:outline-none"
                      [ngClass]="{
                        'border-line bg-paper text-ink-faint hover:border-ink/20': psoMatrix[getMatrixKey(co.coId!, pso.psoId!)] === null,
                        'border-brand-100 bg-brand-50 text-brand-700': psoMatrix[getMatrixKey(co.coId!, pso.psoId!)] === 1,
                        'border-brand-200 bg-brand-100 text-brand-800': psoMatrix[getMatrixKey(co.coId!, pso.psoId!)] === 2,
                        'border-brand bg-brand text-white': psoMatrix[getMatrixKey(co.coId!, pso.psoId!)] === 3
                      }" [attr.aria-label]="co.coCode + ' to ' + pso.psoCode + ' correlation'">
                      <option [ngValue]="null">-</option>
                      <option [ngValue]="1">1</option>
                      <option [ngValue]="2">2</option>
                      <option [ngValue]="3">3</option>
                    </select>
                  </td>

                </tr>
                
                <tr *ngIf="cos.length === 0">
                  <td [attr.colspan]="1 + pos.length + psos.length" class="td text-center">
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