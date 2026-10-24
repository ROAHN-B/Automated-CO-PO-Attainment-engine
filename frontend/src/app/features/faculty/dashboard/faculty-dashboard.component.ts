import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FacultyDashboard, FacultyOffering } from '../../../core/models/faculty-workspace.model';
import { FacultyWorkspaceService, WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { CURRENT_USER } from '../../../core/session/current-user';
import { IconComponent } from '../../../shared/ui/icon.component';
import { groupStatus, lifecycleGroups, nextActionLink, phaseLabel, stepCounts } from '../lifecycle';

/**
 * Faculty dashboard — course-centric hub (API_CONTRACT v2.2 §7).
 * Shows what needs the faculty's action now, then every allocated course with
 * its lifecycle progress and single next action. No editable state.
 */
@Component({
  selector: 'app-faculty-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, IconComponent],
  templateUrl: './faculty-dashboard.component.html',
})
export class FacultyDashboardComponent {
  private readonly api = inject(FacultyWorkspaceService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = CURRENT_USER;
  readonly greeting = greetingFor(new Date());

  readonly data = signal<FacultyDashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);

  readonly waitingOnLab = computed(() =>
    this.data()?.offerings.filter(o => o.progress.nextAction?.actor === 'LAB_ASSISTANT').length ?? 0);
  readonly readyToSubmit = computed(() =>
    this.data()?.offerings.filter(o => o.progress.closeOut.submission.status === 'AVAILABLE').length ?? 0);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.dashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  /* ---- view helpers (presentation only) ---- */

  phase(o: FacultyOffering): string { return phaseLabel(o.progress.phase); }
  counts(o: FacultyOffering) { return stepCounts(o.progress); }
  groups(o: FacultyOffering) {
    return lifecycleGroups(o.progress).map(g => ({ id: g.id, title: g.title, status: groupStatus(g) }));
  }
  courseLink(o: FacultyOffering): string[] { return ['/faculty/courses', o.offeringId]; }
  actionLink(o: FacultyOffering): string[] {
    const l = nextActionLink(o);
    return l ? [...this.courseLink(o), ...l.path] : this.courseLink(o);
  }
  actionQuery(o: FacultyOffering): Record<string, string> | null { return nextActionLink(o)?.query ?? null; }
  attentionLink(offeringId: string): string[] {
    const o = this.data()?.offerings.find(x => x.offeringId === offeringId);
    return o ? this.actionLink(o) : ['/faculty/courses', offeringId];
  }
  attentionQuery(offeringId: string): Record<string, string> | null {
    const o = this.data()?.offerings.find(x => x.offeringId === offeringId);
    return o ? this.actionQuery(o) : null;
  }
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
