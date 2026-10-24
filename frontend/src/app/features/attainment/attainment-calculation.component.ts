import { Component, HostListener, inject, signal } from '@angular/core';
import { AttainmentService } from '../../core/services/attainment.service';
import { CoAttainmentRecord } from '../../core/models/attainment.model';
import { AttainmentLevel } from '../../core/models';
import { IconComponent } from '../../shared/ui/icon.component';
import { LevelMeterComponent } from '../../shared/ui/level-meter/level-meter.component';

@Component({
  selector: 'app-attainment-calculation',
  standalone: true,
  imports: [IconComponent, LevelMeterComponent],
  template: `
    <div class="page stagger">

      <header class="page-header" style="--i:0">
        <div>
          <p class="page-kicker">Outcomes · Data Structures (CS501)</p>
          <h1 class="page-title">CO-PO attainment</h1>
          <p class="page-subtitle">Review lab marksheets, run the attainment calculation and export the accreditation matrix.</p>
        </div>
        <div class="page-actions">
          <button type="button" class="btn btn-outline" (click)="openMarksheetModal.set(true)">
            <app-icon name="inbox" class="h-4 w-4" />
            Lab marksheets
          </button>
          <button type="button" class="btn btn-primary" [disabled]="calculating()" (click)="recalculateAttainment()">
            @if (calculating()) {
              <span class="spinner" aria-hidden="true"></span> Calculating…
            } @else {
              <app-icon name="refresh" class="h-4 w-4" /> Run calculation
            }
          </button>
        </div>
      </header>

      <!-- Status line for the last action (replaces browser alerts) -->
      <p class="sr-only" aria-live="polite">{{ status() }}</p>
      @if (status()) {
        <div class="alert alert-success mt-6 animate-fade-in" role="status">
          <app-icon name="check" class="mt-0.5 h-4 w-4" [stroke]="2" />
          <span class="flex-1">{{ status() }}</span>
          <button type="button" class="text-[13px] font-medium opacity-70 hover:opacity-100" (click)="status.set('')">Dismiss</button>
        </div>
      }

      <!-- Pending marksheet -->
      <section class="card mt-6 flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center" style="--i:1">
        <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <app-icon name="table" class="h-[18px] w-[18px]" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-ink">New lab marksheet for Internal Test 1</p>
          <p class="mt-0.5 truncate text-[13px] text-ink-muted">
            <span class="font-mono text-xs">CS501_IT1_Marks.xlsx</span> · uploaded by the lab assistant · ready to process
          </p>
        </div>
        <button type="button" class="btn btn-outline btn-sm" (click)="importAndProcess()">Import &amp; calculate</button>
      </section>

      <!-- CO attainment table -->
      <section class="card mt-6 overflow-hidden" style="--i:2" aria-labelledby="co-title">
        <div class="card-header">
          <div>
            <h2 id="co-title" class="section-title">Course outcome attainment</h2>
            <p class="section-subtitle">Weighted 80% direct, 20% indirect, as returned by the engine.</p>
          </div>
          <span class="chip chip-neutral">{{ attainmentRecords.length }} outcomes</span>
        </div>

        <div class="table-wrap">
          <table class="data-table min-w-[720px]">
            <thead>
              <tr>
                <th class="th w-[44%]" scope="col">Course outcome</th>
                <th class="th text-right" scope="col">Direct</th>
                <th class="th text-right" scope="col">Indirect</th>
                <th class="th text-right" scope="col">Final</th>
                <th class="th" scope="col">Level</th>
              </tr>
            </thead>
            <tbody>
              @for (record of attainmentRecords; track record.coId) {
                <tr>
                  <td class="td">
                    <span class="font-mono text-[13px] font-medium text-ink">{{ record.coId }}</span>
                    <span class="ml-2 text-ink-soft">{{ record.description }}</span>
                  </td>
                  <td class="td text-right tnum">{{ record.directScore }}%</td>
                  <td class="td text-right tnum">{{ record.indirectScore }}%</td>
                  <td class="td text-right font-semibold text-ink tnum">{{ record.finalScore }}%</td>
                  <td class="td"><app-level-meter [level]="asLevel(record.level)" [showLabel]="true" size="sm" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Export -->
      <section class="card mt-6 flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between" style="--i:3">
        <div>
          <h2 class="section-title">CO-PO attainment matrix</h2>
          <p class="section-subtitle">The complete correlation matrix and attainment report, formatted for submission.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-outline" (click)="downloadMatrix('excel')">
            <app-icon name="download" class="h-4 w-4" /> Excel
          </button>
          <button type="button" class="btn btn-dark" (click)="downloadMatrix('pdf')">
            <app-icon name="download" class="h-4 w-4" /> PDF report
          </button>
        </div>
      </section>
    </div>

    <!-- Lab marksheet review dialog -->
    @if (openMarksheetModal()) {
      <div class="modal-backdrop" (click)="openMarksheetModal.set(false)">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ms-title" (click)="$event.stopPropagation()">
          <div class="card-header">
            <div>
              <h3 id="ms-title" class="section-title">Lab marksheet submissions</h3>
              <p class="section-subtitle">Approve a marksheet to include it in the next calculation.</p>
            </div>
            <button type="button" class="btn btn-ghost btn-icon" (click)="openMarksheetModal.set(false)" aria-label="Close">
              <app-icon name="close" class="h-5 w-5" />
            </button>
          </div>
          <ul class="divide-y divide-line">
            <li class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0">
                <p class="truncate font-mono text-[13px] font-medium text-ink">CS501_IT1_Marks.xlsx</p>
                <p class="mt-0.5 text-[13px] text-ink-muted">Lab assistant · 24 Sep 2026 · 72 students</p>
              </div>
              <button type="button" class="btn btn-primary btn-sm" (click)="importAndProcess()">Approve &amp; process</button>
            </li>
          </ul>
        </div>
      </div>
    }
  `
})
export class AttainmentCalculationComponent {
  private attainmentService = inject(AttainmentService);

  readonly openMarksheetModal = signal(false);
  readonly calculating = signal(false);
  readonly status = signal('');

  attainmentRecords: CoAttainmentRecord[] = [
    { coId: 'CO1', description: 'Apply appropriate data structures to solve computational problems', directScore: 78.5, indirectScore: 82.0, finalScore: 79.2, level: 3 },
    { coId: 'CO2', description: 'Design efficient sorting and searching algorithms', directScore: 71.2, indirectScore: 75.0, finalScore: 72.0, level: 3 },
    { coId: 'CO3', description: 'Analyze asymptotic runtime complexities of algorithms', directScore: 64.0, indirectScore: 70.0, finalScore: 65.2, level: 2 },
    { coId: 'CO4', description: 'Implement non-linear tree and graph data structures', directScore: 82.5, indirectScore: 85.0, finalScore: 83.0, level: 3 }
  ];

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openMarksheetModal.set(false);
  }

  asLevel(level: number): AttainmentLevel {
    return (level >= 0 && level <= 3 ? level : 0) as AttainmentLevel;
  }

  importAndProcess(): void {
    this.openMarksheetModal.set(false);
    this.status.set('Lab marksheet imported. The attainment engine has been triggered.');
  }

  recalculateAttainment(): void {
    this.calculating.set(true);
    this.attainmentService.triggerRecalculation('crs_01').subscribe({
      next: () => {
        this.calculating.set(false);
        this.status.set('Attainment recalculated with the latest approved marks.');
      },
      error: () => this.calculating.set(false),
    });
  }

  downloadMatrix(format: 'excel' | 'pdf'): void {
    this.status.set(`Preparing the ${format === 'excel' ? 'Excel matrix' : 'PDF report'}. It will download when ready.`);
  }
}
