import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AttainmentLevel } from '../../core/models';
import { DashboardService } from '../../core/services/dashboard.service';
import { CURRENT_USER } from '../../core/session/current-user';
import { LevelMeterComponent } from '../../shared/ui/level-meter/level-meter.component';

/**
 * One stage of the attainment workflow.
 *
 * Note there is deliberately NO `description` field. The cards are icon-led:
 * a large plated icon plus a bold title carries the meaning, and omitting the
 * field entirely means explanatory paragraphs can't creep back in later.
 */
interface WorkflowStage {
  /** Zero-padded position, e.g. '01'. The order is a real dependency chain. */
  stage: string;
  title: string;
  /** Scope/mode marker only — never a description. e.g. 'AI assisted'. */
  tag?: string;
  route: string;
  /** Short imperative verb for the action footer. */
  cta: string;
  /** SVG path `d` string, drawn at 28–32px inside the plate. */
  icon: string;
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
 * FacultyDashboardComponent — the Command Center (hub).
 *
 * A launcher, not a workspace: a record header, an aggregate metrics strip and
 * the five-stage workflow pipeline. No tables, no forms, no editable state —
 * anything that needs those belongs in its own routed spoke.
 */
@Component({
  selector: 'app-faculty-dashboard',
  standalone: true,
  imports: [DecimalPipe, RouterLink, LevelMeterComponent],
  templateUrl: './faculty-dashboard.component.html',
})
export class FacultyDashboardComponent {
  private readonly dashboard = inject(DashboardService);

  /** Shared with the sidebar profile card — one source of truth for identity. */
  readonly user = CURRENT_USER;

  readonly metrics = toSignal(this.dashboard.getMetrics(), { initialValue: null });

  /** Attainment level for the headline average, using the standard thresholds. */
  readonly overallLevel = computed<AttainmentLevel>(() => {
    const m = this.metrics();
    return m ? this.levelFor(m.avgCoAttainment) : 0;
  });

  /**
   * Instrument caption under the headline figure: which band we're in and what
   * it would take to reach the next one. Derived from the same thresholds as
   * `levelFor`, so the two can never disagree.
   */
  readonly bandNote = computed<string>(() => {
    const m = this.metrics();
    if (!m) return '';
    const level = this.overallLevel();
    if (level === 3) return 'Level 3 · target met';
    const nextBand = level === 2 ? 75 : level === 1 ? 60 : 40;
    const shortfall = nextBand - m.avgCoAttainment;
    return `Level ${level} · ${shortfall.toFixed(1)} pts to Level ${level + 1} (≥ ${nextBand}%)`;
  });

  /** The four summary numbers worth surfacing on the hub. */
  readonly metricCards = computed<MetricCard[]>(() => {
    const m = this.metrics();
    if (!m) return [];
    return [
      { label: 'Active courses', value: m.activeCourses, unit: 'this term' },
      { label: 'Course outcomes', value: m.cosDefined, unit: 'defined & mapped' },
      { label: 'Reference units', value: m.embeddedUnits, unit: 'vector-embedded' },
      { label: 'Pending reviews', value: m.pendingReviews, unit: 'awaiting sign-off', warnWhenSet: true },
    ];
  });

  /**
   * The five stages in strict chronological order. This is a genuine dependency
   * chain, not decorative numbering: you cannot generate a paper before the
   * unit is embedded, cannot compute attainment before the paper is marked, and
   * cannot lock the record before the HOD signs it off.
   */
  readonly stages: WorkflowStage[] = [
    {
      stage: '01',
      title: 'Reference & Vector Manager',
      route: '/faculty/manage-references',
      cta: 'Manage',
      icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
    },
    {
      stage: '02',
      title: 'AI Question Generation',
      tag: 'AI assisted',
      route: '/faculty/generate-questions',
      cta: 'Open wizard',
      icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z',
    },
    {
      stage: '03',
      title: 'CO-PO Attainment Engine',
      route: '/faculty/calculate-attainment',
      cta: 'Calculate',
      icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
    },
    {
      stage: '04',
      title: 'Report Analysis',
      tag: 'AI assisted',
      route: '/faculty/report-analysis',
      cta: 'Analyse',
      icon: 'M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z',
    },
    {
      stage: '05',
      title: 'HOD Approval Inbox',
      tag: 'HOD sign-off',
      route: '/hod/dashboard',
      cta: 'Review',
      icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z',
    },
  ];

  levelFor(pct: number): AttainmentLevel {
    if (pct >= 75) return 3;
    if (pct >= 60) return 2;
    if (pct >= 40) return 1;
    return 0;
  }
}
