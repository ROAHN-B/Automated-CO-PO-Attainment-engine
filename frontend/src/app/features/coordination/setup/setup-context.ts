import { Injectable, computed, inject, signal } from '@angular/core';
import { SemesterSetup } from '../../../core/models/coordination.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { setupSteps } from '../setup-steps';

/**
 * The semester setup the workspace is showing. Provided by SemesterSetupComponent
 * so its step screens share one copy and can refresh it after an action
 * (e.g. declaring the syllabus unlocks the allocation).
 */
@Injectable()
export class SetupContext {
  private readonly api = inject(CoordinationService);

  readonly setupId = signal('');
  readonly setup = signal<SemesterSetup | null>(null);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);

  readonly steps = computed(() => {
    const s = this.setup();
    return s ? setupSteps(s) : [];
  });
  readonly current = computed(() => this.steps().find(s => s.current) ?? null);

  load(setupId: string): void {
    this.setupId.set(setupId);
    this.refresh(true);
  }

  /** Re-fetch the setup (step states, version) — call after any state-changing action. */
  refresh(showLoading = false): void {
    const id = this.setupId();
    if (!id) return;
    if (showLoading) this.loading.set(true);
    this.error.set(null);
    this.api.setup(id).subscribe({
      next: s => { this.setup.set(s); this.loading.set(false); },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }
}
