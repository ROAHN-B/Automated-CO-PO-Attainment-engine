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
    <div>
      <div class="mx-auto w-full max-w-7xl space-y-8 animate-enter">

        <div class="page-header">
          <div>
            <p class="page-kicker">Outcomes</p>
            <h1 class="page-title">POs &amp; PSOs</h1>
            <p class="page-subtitle">Define institutional Program Outcomes (POs) and Program-Specific Outcomes (PSOs).</p>
          </div>
        </div>

        <div *ngIf="successMessage" class="alert alert-success">
          <p class="text-sm text-met font-medium">{{ successMessage }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <!-- Column 1: Program Outcomes (POs) -->
          <div class="card p-6 space-y-6">
            <div class="flex justify-between items-center border-b border-line pb-3">
              <h3 class="section-title text-ink">Program outcomes (POs)</h3>
              <span class="chip chip-brand">Global</span>
            </div>

            <div class="space-y-3 max-h-72 overflow-y-auto pr-2">
              <div *ngFor="let po of pos" class="p-4 bg-paper border border-line rounded-lg">
                <div class="flex justify-between items-center mb-2">
                  <span class="font-bold text-ink">{{ po.poCode }}</span>
                  <span class="text-[10px] font-bold tracking-wide" 
                        [ngClass]="po.status === 'ACTIVE' ? 'text-met' : 'text-ink-muted'">
                    {{ po.status }}
                  </span>
                </div>
                <p class="text-xs text-ink-soft leading-relaxed">{{ po.poStatement }}</p>
              </div>
            </div>

            <form [formGroup]="poForm" (ngSubmit)="onCreatePO()" class="space-y-3 pt-4 border-t border-line">
              <h4 class="text-xs font-bold text-ink-soft">Add New PO</h4>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-[10px] font-medium text-ink-muted mb-1">PO Code *</label>
                  <input type="text" formControlName="poCode" placeholder="e.g. PO1" class="field-input">
                </div>
                <div class="col-span-2">
                  <label class="block text-[10px] font-medium text-ink-muted mb-1">Status</label>
                  <select formControlName="status" class="field-select">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-medium text-ink-muted mb-1">PO Statement *</label>
                <textarea formControlName="poStatement" rows="3" placeholder="Enter full outcome statement..." class="field-textarea"></textarea>
              </div>
              <button type="submit" [disabled]="poForm.invalid" class="btn btn-primary btn-sm w-full">
                Save Program Outcome
              </button>
            </form>
          </div>

          <!-- Column 2: Program Specific Outcomes (PSOs) -->
          <div class="card p-6 space-y-6">
            <div class="flex justify-between items-center border-b border-line pb-3">
              <h3 class="section-title text-ink">Program specific outcomes (PSOs)</h3>
            </div>

            <!-- Program Selector -->
            <div>
              <label class="block text-[10px] font-medium text-ink-muted mb-1">Select Program Context *</label>
              <select [formControl]="programCtrl" class="field-select">
                <option value="">-- Choose Program --</option>
                <option *ngFor="let prog of programs" [value]="prog.programId">{{ prog.programShortName }} - {{ prog.programName }}</option>
              </select>
            </div>

            <div *ngIf="programCtrl.value" class="space-y-3 max-h-60 overflow-y-auto pr-2">
              <div *ngIf="psos.length === 0" class="text-xs text-ink-muted italic text-center py-4 border border-dashed rounded-lg">
                No PSOs defined for this program yet.
              </div>
              <div *ngFor="let pso of psos" class="p-4 bg-paper border border-line rounded-lg">
                <div class="flex justify-between items-center mb-2">
                  <span class="font-bold text-ink">{{ pso.psoCode }}</span>
                  <span class="text-[10px] font-bold tracking-wide text-met">{{ pso.status }}</span>
                </div>
                <p class="text-xs text-ink-soft leading-relaxed">{{ pso.psoStatement }}</p>
              </div>
            </div>

            <form *ngIf="programCtrl.value" [formGroup]="psoForm" (ngSubmit)="onCreatePSO()" class="space-y-3 pt-4 border-t border-line">
              <h4 class="text-xs font-bold text-ink-soft">Add New PSO</h4>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-[10px] font-medium text-ink-muted mb-1">PSO Code *</label>
                  <input type="text" formControlName="psoCode" placeholder="e.g. PSO1" class="field-input">
                </div>
                <div class="col-span-2">
                  <label class="block text-[10px] font-medium text-ink-muted mb-1">Status</label>
                  <select formControlName="status" class="field-select">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-medium text-ink-muted mb-1">PSO Statement *</label>
                <textarea formControlName="psoStatement" rows="2" placeholder="Enter specific outcome statement..." class="field-textarea"></textarea>
              </div>
              <button type="submit" [disabled]="psoForm.invalid" class="btn btn-primary btn-sm w-full">
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