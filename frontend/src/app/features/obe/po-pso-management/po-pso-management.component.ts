import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CourseObeService } from '../../../core/services/course-obe.service';
import { AcademicStructureService } from '../../../core/services/academic-structure.service';
import { ProgramOutcome, ProgramSpecificOutcome } from '../../../core/models/epic2-course-obe.model';
import { Program } from '../../../core/models/academic-structure.model';

@Component({
  selector: 'app-po-pso-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
      <div class="max-w-7xl mx-auto space-y-8">

        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">PO & PSO Master Management</h1>
            <p class="text-slate-600 mt-1">Define institutional Program Outcomes (POs) and Program-Specific Outcomes (PSOs).</p>
          </div>
        </div>

        <div *ngIf="successMessage" class="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg">
          <p class="text-sm text-emerald-700 font-medium">{{ successMessage }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <!-- Column 1: Program Outcomes (POs) -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-6">
            <div class="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 class="text-lg font-bold text-slate-900">Program Outcomes (POs)</h3>
              <span class="px-2.5 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded-full font-medium">Global</span>
            </div>

            <div class="space-y-3 max-h-72 overflow-y-auto pr-2">
              <div *ngFor="let po of pos" class="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div class="flex justify-between items-center mb-2">
                  <span class="font-bold text-slate-900">{{ po.poCode }}</span>
                  <span class="text-[10px] uppercase font-bold tracking-wide" 
                        [ngClass]="po.status === 'ACTIVE' ? 'text-emerald-600' : 'text-slate-400'">
                    {{ po.status }}
                  </span>
                </div>
                <p class="text-xs text-slate-600 leading-relaxed">{{ po.poStatement }}</p>
              </div>
            </div>

            <form [formGroup]="poForm" (ngSubmit)="onCreatePO()" class="space-y-3 pt-4 border-t border-slate-100">
              <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Add New PO</h4>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-[10px] font-medium text-slate-500 mb-1">PO Code *</label>
                  <input type="text" formControlName="poCode" placeholder="e.g. PO1" class="w-full px-2 py-1.5 text-xs border rounded">
                </div>
                <div class="col-span-2">
                  <label class="block text-[10px] font-medium text-slate-500 mb-1">Status</label>
                  <select formControlName="status" class="w-full px-2 py-1.5 text-xs border rounded">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-medium text-slate-500 mb-1">PO Statement *</label>
                <textarea formControlName="poStatement" rows="3" placeholder="Enter full outcome statement..." class="w-full px-2 py-1.5 text-xs border rounded"></textarea>
              </div>
              <button type="submit" [disabled]="poForm.invalid" class="w-full py-2 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                Save Program Outcome
              </button>
            </form>
          </div>

          <!-- Column 2: Program Specific Outcomes (PSOs) -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 space-y-6">
            <div class="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 class="text-lg font-bold text-slate-900">Program Specific Outcomes (PSOs)</h3>
            </div>

            <!-- Program Selector -->
            <div>
              <label class="block text-[10px] font-medium text-slate-500 mb-1">Select Program Context *</label>
              <select [formControl]="programCtrl" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-slate-50">
                <option value="">-- Choose Program --</option>
                <option *ngFor="let prog of programs" [value]="prog.programId">{{ prog.programShortName }} - {{ prog.programName }}</option>
              </select>
            </div>

            <div *ngIf="programCtrl.value" class="space-y-3 max-h-60 overflow-y-auto pr-2">
              <div *ngIf="psos.length === 0" class="text-xs text-slate-400 italic text-center py-4 border border-dashed rounded-lg">
                No PSOs defined for this program yet.
              </div>
              <div *ngFor="let pso of psos" class="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div class="flex justify-between items-center mb-2">
                  <span class="font-bold text-slate-900">{{ pso.psoCode }}</span>
                  <span class="text-[10px] uppercase font-bold tracking-wide text-emerald-600">{{ pso.status }}</span>
                </div>
                <p class="text-xs text-slate-600 leading-relaxed">{{ pso.psoStatement }}</p>
              </div>
            </div>

            <form *ngIf="programCtrl.value" [formGroup]="psoForm" (ngSubmit)="onCreatePSO()" class="space-y-3 pt-4 border-t border-slate-100">
              <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Add New PSO</h4>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-[10px] font-medium text-slate-500 mb-1">PSO Code *</label>
                  <input type="text" formControlName="psoCode" placeholder="e.g. PSO1" class="w-full px-2 py-1.5 text-xs border rounded">
                </div>
                <div class="col-span-2">
                  <label class="block text-[10px] font-medium text-slate-500 mb-1">Status</label>
                  <select formControlName="status" class="w-full px-2 py-1.5 text-xs border rounded">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-medium text-slate-500 mb-1">PSO Statement *</label>
                <textarea formControlName="psoStatement" rows="2" placeholder="Enter specific outcome statement..." class="w-full px-2 py-1.5 text-xs border rounded"></textarea>
              </div>
              <button type="submit" [disabled]="psoForm.invalid" class="w-full py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 disabled:opacity-50 transition-colors">
                Save Program Specific Outcome
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  `
})
export class PoPsoManagementComponent implements OnInit {
  private obeService = inject(CourseObeService);
  private academicService = inject(AcademicStructureService);
  private fb = inject(FormBuilder);

  pos: ProgramOutcome[] = [];
  psos: ProgramSpecificOutcome[] = [];
  programs: Program[] = [];

  programCtrl = this.fb.control('');
  poForm!: FormGroup;
  psoForm!: FormGroup;
  successMessage = '';

  ngOnInit(): void {
    this.initForms();
    this.loadInitialData();
    this.setupSubscriptions();
  }

  private initForms(): void {
    this.poForm = this.fb.group({
      poCode: ['', Validators.required],
      poStatement: ['', Validators.required],
      status: ['ACTIVE']
    });

    this.psoForm = this.fb.group({
      psoCode: ['', Validators.required],
      psoStatement: ['', Validators.required],
      status: ['ACTIVE']
    });
  }

  private loadInitialData(): void {
    this.obeService.getProgramOutcomes().subscribe(data => this.pos = data);
    this.academicService.getPrograms().subscribe(data => this.programs = data);
  }

  private setupSubscriptions(): void {
    this.programCtrl.valueChanges.subscribe(progId => {
      this.psos = [];
      if (progId) {
        this.obeService.getProgramSpecificOutcomes(progId).subscribe(data => this.psos = data);
      }
    });
  }

  onCreatePO(): void {
    if (this.poForm.invalid) return;
    this.obeService.createProgramOutcome(this.poForm.value).subscribe(res => {
      this.pos.push(res);
      this.showSuccess(`Global PO ${res.poCode} saved successfully.`);
      this.poForm.reset({ status: 'ACTIVE' });
    });
  }

  onCreatePSO(): void {
    if (this.psoForm.invalid || !this.programCtrl.value) return;
    const payload = { ...this.psoForm.value, programId: this.programCtrl.value };
    
    this.obeService.createProgramSpecificOutcome(payload).subscribe(res => {
      this.psos.push(res);
      this.showSuccess(`Program Specific Outcome ${res.psoCode} saved successfully.`);
      this.psoForm.reset({ status: 'ACTIVE' });
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 4000);
  }
}