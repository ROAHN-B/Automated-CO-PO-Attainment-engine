import { Injectable, inject, signal } from '@angular/core';
import { FacultyOffering } from '../../../core/models/faculty-workspace.model';
import { FacultyWorkspaceService, WorkspaceError } from '../../../core/services/faculty-workspace.service';

/**
 * The course the workspace is showing. Provided by CourseWorkspaceComponent so
 * its child screens share one copy and can ask for a refresh after an action
 * (e.g. approving attainment unlocks the next cycle).
 */
@Injectable()
export class CourseContext {
  private readonly api = inject(FacultyWorkspaceService);

  readonly offeringId = signal<string>('');
  readonly offering = signal<FacultyOffering | null>(null);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);

  load(offeringId: string): void {
    this.offeringId.set(offeringId);
    this.refresh(true);
  }

  /** Re-fetch the course (progress, locks) — call after any state-changing action. */
  refresh(showLoading = false): void {
    const id = this.offeringId();
    if (!id) return;
    if (showLoading) this.loading.set(true);
    this.error.set(null);
    this.api.offering(id).subscribe({
      next: o => { this.offering.set(o); this.loading.set(false); },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }
}
