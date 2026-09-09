import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AiInsight,
  Course,
  InsightCategory,
  ReportAnalysis,
  ReportAnalysisRequest,
} from '../../core/models';
import { CourseService } from '../../core/services/course.service';
import { ReportAnalysisService } from '../../core/services/report-analysis.service';

type CategoryFilter = InsightCategory | 'ALL';

/**
 * ReportAnalysisComponent — Epic 4 workflow (generative, Mayuri's RAG/LLM).
 * Reads a course's attainment result and returns a narrative: an executive
 * summary, categorised insights (gaps / strengths / recommendations), a
 * multi-year trend, and concrete actions. AI surfaces wear the violet accent.
 */
@Component({
  selector: 'app-report-analysis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-analysis.component.html',
})
export class ReportAnalysisComponent {
  private readonly analysisSvc = inject(ReportAnalysisService);
  private readonly courseSvc = inject(CourseService);
  private readonly destroyRef = inject(DestroyRef);

  readonly courses = signal<Course[]>([]);
  readonly courseId = signal('');
  readonly analyzing = signal(false);
  readonly analysis = signal<ReportAnalysis | null>(null);
  readonly filter = signal<CategoryFilter>('ALL');

  readonly filters: { value: CategoryFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'ATTAINMENT_GAP', label: 'Gaps' },
    { value: 'STRENGTH', label: 'Strengths' },
    { value: 'RECOMMENDATION', label: 'Recommendations' },
    { value: 'ACTION_ITEM', label: 'Actions' },
  ];

  readonly selectedCourse = computed(() => this.courses().find(c => c.courseId === this.courseId()) ?? null);

  readonly filteredInsights = computed<AiInsight[]>(() => {
    const all = this.analysis()?.insights ?? [];
    const f = this.filter();
    return f === 'ALL' ? all : all.filter(i => i.category === f);
  });

  /** Count of insights per filter, for the segmented control badges. */
  readonly filterCounts = computed<Record<CategoryFilter, number>>(() => {
    const all = this.analysis()?.insights ?? [];
    const base = { ALL: all.length } as Record<CategoryFilter, number>;
    for (const f of this.filters) {
      if (f.value !== 'ALL') base[f.value] = all.filter(i => i.category === f.value).length;
    }
    return base;
  });

  /** SVG geometry for the CO-attainment trend line (0–100 scale). */
  readonly trendGeom = computed(() => {
    const t = this.analysis()?.trends ?? [];
    if (t.length < 2) return null;
    const W = 640, H = 180, padX = 32, padTop = 16, padBottom = 40;
    const innerW = W - padX * 2;
    const y = (v: number) => padTop + (1 - v / 100) * (H - padTop - padBottom);
    const pts = t.map((p, i) => ({
      x: padX + (i * innerW) / (t.length - 1),
      y: y(p.overallCoAttainment),
      co: p.overallCoAttainment,
      po: p.overallPoAttainment,
      period: p.period,
    }));
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${(H - padBottom).toFixed(1)} L${pts[0].x.toFixed(1)},${(H - padBottom).toFixed(1)} Z`;
    const grid = [0, 25, 50, 75, 100].map(v => ({ v, y: y(v) }));
    return { W, H, pts, line, area, grid, baseline: H - padBottom };
  });

  constructor() {
    this.courseSvc.getCourses().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(cs => {
      this.courses.set(cs);
      if (cs.length && !this.courseId()) this.courseId.set(cs[0].courseId);
    });
  }

  onCourseChange(id: string): void {
    this.courseId.set(id);
    this.analysis.set(null);
    this.filter.set('ALL');
  }

  analyze(): void {
    if (!this.courseId()) return;
    const req: ReportAnalysisRequest = { courseId: this.courseId() };
    this.analyzing.set(true);
    this.analysisSvc.analyzeReport(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: a => { this.analysis.set(a); this.analyzing.set(false); this.filter.set('ALL'); },
      error: () => this.analyzing.set(false),
    });
  }

  /* ------------------------------ helpers ----------------------------- */

  /** Left-border accent by severity (falls back to category for INFO). */
  severityAccent(i: AiInsight): string {
    if (i.severity === 'CRITICAL') return 'border-l-gap';
    if (i.severity === 'WARNING') return 'border-l-partial';
    if (i.category === 'STRENGTH') return 'border-l-met';
    return 'border-l-ai';
  }

  iconWrap(i: AiInsight): string {
    if (i.severity === 'CRITICAL') return 'bg-gap-50 text-gap';
    if (i.severity === 'WARNING') return 'bg-partial-50 text-partial';
    if (i.category === 'STRENGTH') return 'bg-met-50 text-met';
    return 'bg-ai-50 text-ai-600';
  }

  categoryChip(category: InsightCategory): string {
    switch (category) {
      case 'ATTAINMENT_GAP': return 'chip-gap';
      case 'STRENGTH': return 'chip-met';
      case 'TREND': return 'chip-brand';
      default: return 'chip-ai';
    }
  }

  categoryLabel(category: InsightCategory): string {
    return {
      ATTAINMENT_GAP: 'Attainment gap',
      STRENGTH: 'Strength',
      TREND: 'Trend',
      RECOMMENDATION: 'Recommendation',
      ACTION_ITEM: 'Action item',
    }[category] ?? category;
  }

  /** Heroicon path per category, drawn inside the accent circle. */
  categoryIcon(i: AiInsight): string {
    if (i.category === 'STRENGTH') return 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    if (i.category === 'ATTAINMENT_GAP') return 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z';
    if (i.category === 'RECOMMENDATION') return 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18';
    return 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z';
  }

  pct(score?: number): string {
    return score == null ? '' : `${Math.round(score * 100)}%`;
  }

  /** PO value (0–3) rendered as a compact chip class. */
  poTone(v: number): string {
    if (v >= 2.5) return 'text-met';
    if (v >= 1.5) return 'text-partial';
    return 'text-gap';
  }
}
