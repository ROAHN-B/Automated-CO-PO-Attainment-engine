import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AttainmentLevel } from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { CURRENT_USER } from '../../core/session/current-user';
import { IconComponent } from '../../shared/ui/icon.component';
import { IconName } from '../../shared/ui/icons';
import { LevelMeterComponent } from '../../shared/ui/level-meter/level-meter.component';

/** One stage of the attainment workflow. */
interface WorkflowStage {
  /** Zero-padded position, e.g. '01'. The order is a real dependency chain. */
  stage: string;
  title: string;
  /** One line on what happens at this stage. */
  summary: string;
  /** Scope/mode marker, e.g. 'AI assisted'. */
  tag?: string;
  route: string;
  /** Short imperative verb for the action. */
  cta: string;
  icon: IconName;
}

/** One cell of the hairline-divided metrics strip. */
interface MetricCard {
  label: string;
  value: number;
  /** Quiet second line giving the number its unit or qualifier. */
  unit: string;
  /** Tints the value amber when non-zero — "needs your attention". */
  warnWhenSet?: boolean;
}

/**
 * FacultyDashboardComponent — the hub.
 *
 * A launcher, not a workspace: a greeting, an aggregate summary panel and the
 * ordered workflow. Anything that needs tables or forms belongs in its own route.
 */
@Component({
  selector: 'app-faculty-dashboard',
  standalone: true,
  imports: [DecimalPipe, RouterLink, IconComponent, LevelMeterComponent],
  templateUrl: './faculty-dashboard.component.html',
})
export class FacultyDashboardComponent {
  private readonly dashboard = inject(DashboardService);

  /** Shared with the shell's user card — one source of truth for identity. */
  readonly user = CURRENT_USER;

  readonly greeting = greetingFor(new Date());

  readonly metrics = toSignal(this.dashboard.getMetrics(), { initialValue: null });

  /**
   * Level for the headline average. MOCK: the bands below stand in until the
   * dashboard endpoint returns the level itself — attainment levels are a
   * backend calculation (see API_CONTRACT.md §14).
   */
  readonly overallLevel = computed<AttainmentLevel>(() => {
    const m = this.metrics();
    return m ? this.levelFor(m.avgCoAttainment) : 0;
  });

  /** The four summary numbers worth surfacing on the hub. */
  readonly metricCards = computed<MetricCard[]>(() => {
    const m = this.metrics();
    if (!m) return [];
    return [
      { label: 'Active courses', value: m.activeCourses, unit: 'this term' },
      { label: 'Course outcomes', value: m.cosDefined, unit: 'defined and mapped' },
      { label: 'Reference units', value: m.embeddedUnits, unit: 'ready for generation' },
      { label: 'Pending reviews', value: m.pendingReviews, unit: 'awaiting sign-off', warnWhenSet: true },
    ];
  });

  /** The five stages in their real dependency order. */
  readonly stages: WorkflowStage[] = [
    {
      stage: '01',
      title: 'Reference library',
      summary: 'Upload notes, papers and textbooks for each unit.',
      route: '/faculty/knowledge-base',
      cta: 'Manage',
      icon: 'stack',
    },
    {
      stage: '02',
      title: 'Question generation',
      summary: 'Draft CO-aligned questions from your references, then review each one.',
      tag: 'AI assisted',
      route: '/faculty/ai-generator',
      cta: 'Open',
      icon: 'sparkles',
    },
    {
      stage: '03',
      title: 'CO-PO attainment',
      summary: 'Review lab marksheets and run the attainment calculation.',
      route: '/faculty/attainment',
      cta: 'Calculate',
      icon: 'chart',
    },
    {
      stage: '04',
      title: 'Report analysis',
      summary: 'Read the gaps and recommendations behind the numbers.',
      tag: 'AI assisted',
      route: '/faculty/reports',
      cta: 'Analyse',
      icon: 'presentation',
    },
    {
      stage: '05',
      title: 'Submit for HOD review',
      summary: 'Send the finished attainment record to your head of department.',
      route: '/faculty/attainment',
      cta: 'Submit',
      icon: 'inbox',
    },
  ];

  levelFor(pct: number): AttainmentLevel {
    if (pct >= 75) return 3;
    if (pct >= 60) return 2;
    if (pct >= 40) return 1;
    return 0;
  }
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
