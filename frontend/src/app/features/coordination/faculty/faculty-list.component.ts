import { NgClass } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { Page } from '../../../core/models/common.model';
import { CredentialStatus, FacultyMember } from '../../../core/models/coordination.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';
import { SETUP_STEP_PURPOSE } from '../setup-steps';
import { SetupContext } from '../setup/setup-context';
import { FacultyFormDialogComponent } from './faculty-form-dialog.component';
import { FacultyImportDialogComponent } from './faculty-import-dialog.component';

/**
 * The department's faculty list (API_CONTRACT §15.3). Shown as step 2 of a
 * semester setup, and on its own from the sidebar: the list belongs to the
 * department and is shared by every semester.
 */
@Component({
  selector: 'app-faculty-list',
  standalone: true,
  imports: [NgClass, FormsModule, RouterLink, IconComponent, BodyPortalDirective, FacultyFormDialogComponent, FacultyImportDialogComponent],
  templateUrl: './faculty-list.component.html',
})
export class FacultyListComponent {
  private readonly api = inject(CoordinationService);
  private readonly destroyRef = inject(DestroyRef);
  /** Present when shown inside a semester setup. */
  readonly ctx = inject(SetupContext, { optional: true });

  readonly purpose = SETUP_STEP_PURPOSE.FACULTY;
  readonly pageSize = 20;

  readonly data = signal<Page<FacultyMember> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<WorkspaceError | null>(null);
  readonly notice = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  search = '';
  status: '' | 'ACTIVE' | 'INACTIVE' = '';
  readonly pageIndex = signal(0);
  private readonly searchChanges = new Subject<void>();

  /** Dialogs. `editing` is null for "add", a member for "edit", undefined when closed. */
  readonly editing = signal<FacultyMember | null | undefined>(undefined);
  readonly importing = signal(false);
  readonly deactivating = signal<FacultyMember | null>(null);

  readonly credentialLabel: Record<CredentialStatus, string> = {
    NOT_INVITED: 'Not invited yet',
    INVITE_SENT: 'Invitation sent',
    ACTIVATED: 'Account active',
    INVITE_EXPIRED: 'Invitation expired',
  };

  constructor() {
    this.searchChanges.pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pageIndex.set(0);
      this.load();
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.facultyList({
      status: this.status || undefined, search: this.search.trim() || undefined, page: this.pageIndex(), size: this.pageSize,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => { this.data.set(p); this.loading.set(false); },
      error: (e: WorkspaceError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  onSearch(): void { this.searchChanges.next(); }

  onStatus(): void {
    this.pageIndex.set(0);
    this.load();
  }

  goToPage(n: number): void {
    this.pageIndex.set(n);
    this.load();
  }

  /** "9000000001" → "90000 00001" */
  phone(p: string): string {
    return p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p;
  }

  /* ---- after any change: reload, and let the setup re-check its steps ---- */

  private changed(message: string): void {
    this.notice.set(message);
    this.actionError.set(null);
    this.load();
    this.ctx?.refresh();
  }

  onSaved(f: FacultyMember, wasEdit: boolean): void {
    this.editing.set(undefined);
    this.changed(wasEdit ? `${f.fullName} updated.` : `${f.fullName} added.`);
  }

  onImported(count: number): void {
    this.changed(`${count} faculty ${count === 1 ? 'member' : 'members'} imported.`);
  }

  setStatus(f: FacultyMember, status: 'ACTIVE' | 'INACTIVE'): void {
    this.busyId.set(f.userId);
    this.api.updateFaculty(f.userId, { status }).subscribe({
      next: m => {
        this.busyId.set(null);
        this.deactivating.set(null);
        this.changed(status === 'ACTIVE' ? `${m.fullName} reactivated.` : `${m.fullName} deactivated.`);
      },
      error: (e: WorkspaceError) => { this.busyId.set(null); this.deactivating.set(null); this.actionError.set(e.message); },
    });
  }

  resend(f: FacultyMember): void {
    this.busyId.set(f.userId);
    this.api.resendInvite(f.userId).subscribe({
      next: m => { this.busyId.set(null); this.changed(`Invitation sent again to ${m.email}.`); },
      error: (e: WorkspaceError) => { this.busyId.set(null); this.actionError.set(e.message); },
    });
  }
}
