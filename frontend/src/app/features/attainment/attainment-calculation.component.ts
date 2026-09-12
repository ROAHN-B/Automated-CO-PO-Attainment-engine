import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  AttainmentConfiguration,
  AttainmentLevel,
  AttainmentReport,
  CalculateAttainmentRequest,
  CoPoMappingEntry,
  Course,
} from '../../core/models';
import { AttainmentService } from '../../core/services/attainment.service';
import { CourseService } from '../../core/services/course.service';
import { LevelMeterComponent } from '../../shared/ui/level-meter/level-meter.component';

/**
 * AttainmentCalculationComponent — Epic 3 (deterministic, Abhijeet).
 * Configure targets/weightage/thresholds, run the calculation engine, then read
 * CO & PO attainment with the CO⇄PO matrix, and submit the report to the HOD.
 */
@Component({
  selector: 'app-attainment-calculation',
  standalone: true,
  imports: [CommonModule, RouterLink, LevelMeterComponent],
  templateUrl: './attainment-calculation.component.html',
})
export class AttainmentCalculationComponent {
  private readonly attainment = inject(AttainmentService);
  private readonly courseSvc = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = signal<Course[]>([]);
  readonly courseId = signal('');
  readonly config = signal<AttainmentConfiguration | null>(null);
  readonly matrix = signal<CoPoMappingEntry[]>([]);
  readonly report = signal<AttainmentReport | null>(null);

  readonly showConfig = signal(false);
  readonly calculating = signal(false);
  readonly saving = signal(false);
  readonly savedTick = signal(false);
  readonly submitting = signal(false);

  readonly selectedCourse = computed(() => this.courses().find(c => c.courseId === this.courseId()) ?? null);

  /* -------- CO⇄PO matrix pivot -------- */
  readonly poCodes = computed(() => [...new Set(this.matrix().map(m => m.poCode))].sort());
  readonly coCodes = computed(() => [...new Set(this.matrix().map(m => m.coCode))].sort());

  readonly configValid = computed(() => {
    const c = this.config();
    if (!c) return false;
    return (
      c.targetPercentage > 0 && c.targetPercentage <= 100 &&
      c.level1Threshold < c.level2Threshold &&
      c.level2Threshold < c.level3Threshold &&
      c.level3Threshold <= 100 &&
      c.directWeightage + c.indirectWeightage === 100
    );
  });

  constructor() {
    this.courseSvc.getCourses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(cs => {
      this.courses.set(cs);
      if (cs.length && !this.courseId()) this.onCourseChange(cs[0].courseId);
    });
  }

  onCourseChange(id: string): void {
    this.courseId.set(id);
    this.report.set(null);
    this.config.set(null);
    this.attainment.getConfig(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(c => this.config.set(c));
    this.attainment.getCoPoMatrix(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(m => this.matrix.set(m));
  }

  /* ------------------------------ config ------------------------------ */
  patch<K extends keyof AttainmentConfiguration>(key: K, value: AttainmentConfiguration[K]): void {
    const c = this.config();
    if (!c) return;
    this.config.set({ ...c, [key]: value });
    this.savedTick.set(false);
  }

  /** Direct/indirect always complement to 100. */
  setDirect(value: number): void {
    const direct = Math.max(0, Math.min(100, Math.round(value || 0)));
    const c = this.config();
    if (!c) return;
    this.config.set({ ...c, directWeightage: direct, indirectWeightage: 100 - direct });
    this.savedTick.set(false);
  }

  saveConfig(): void {
    const c = this.config();
    if (!c || !this.configValid()) return;
    this.saving.set(true);
    this.attainment.saveConfig(c).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(saved => {
      this.config.set(saved);
      this.saving.set(false);
      this.savedTick.set(true);
    });
  }

  /* ---------------------------- calculate ----------------------------- */
  calculate(): void {
    if (!this.config()) return;
    const req: CalculateAttainmentRequest = { courseId: this.courseId(), config: this.config()! };
    this.calculating.set(true);
    this.report.set(null);
    this.attainment.calculate(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => { this.report.set(r); this.calculating.set(false); },
      error: () => this.calculating.set(false),
    });
  }

  submitToHod(): void {
    const r = this.report();
    if (!r) return;
    this.submitting.set(true);
    this.attainment.submitToHod(r.reportId!).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => { this.report.set(updated); this.submitting.set(false); },
      error: () => this.submitting.set(false),
    });
  }

  /* ------------------------------ helpers ----------------------------- */
  levelFor(pct: number): AttainmentLevel {
    const c = this.config();
    const t1 = c?.level1Threshold ?? 40, t2 = c?.level2Threshold ?? 60, t3 = c?.level3Threshold ?? 75;
    if (pct >= t3) return 3;
    if (pct >= t2) return 2;
    if (pct >= t1) return 1;
    return 0;
  }

  /** Overall PO value (0–3 scale) → nearest level for the meter. */
  poValueLevel(value: number): AttainmentLevel {
    return Math.max(0, Math.min(3, Math.round(value))) as AttainmentLevel;
  }

  correlation(coCode: string, poCode: string): number | null {
    return this.matrix().find(m => m.coCode === coCode && m.poCode === poCode)?.correlation ?? null;
  }

  corrClass(v: number | null): string {
    switch (v) {
      case 3: return 'bg-brand text-white';
      case 2: return 'bg-brand-100 text-brand-800';
      case 1: return 'bg-brand-50 text-brand-700';
      default: return 'text-ink-faint';
    }
  }

  statusChip(status: string): string {
    switch (status) {
      case 'APPROVED': return 'chip-met';
      case 'SUBMITTED_TO_HOD': return 'chip-brand';
      case 'REVISION_REQUESTED': return 'chip-partial';
      default: return 'chip-neutral';
    }
  }
  statusLabel(status: string): string {
    return { DRAFT: 'Draft', SUBMITTED_TO_HOD: 'Submitted to HOD', APPROVED: 'Approved', REVISION_REQUESTED: 'Revision requested' }[status] ?? status;
  }
}
