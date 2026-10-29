import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InstitutionUpdate } from '../../../core/models/admin.model';
import { AdminService } from '../../../core/services/admin.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { IconComponent } from '../../../shared/ui/icon.component';

/**
 * The institution profile (API_CONTRACT §16 ADM-1): code, name and the email
 * domains every user's college email must use. The first save creates it.
 */
@Component({
  selector: 'app-institution-setup',
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="page space-y-6">
      <header class="page-header">
        <div>
          <p class="page-kicker">Administration</p>
          <h1 class="page-title">Institution</h1>
          <p class="page-subtitle">The college this platform serves. Faculty and staff accounts must use one of its email domains.</p>
        </div>
      </header>

      @if (loading()) {
        <div class="skeleton h-72" aria-busy="true" aria-label="Loading the institution"></div>
      } @else if (loadError()) {
        <div class="alert alert-error" role="alert">
          <app-icon name="alert" class="mt-0.5 h-4 w-4" />
          <div class="flex-1"><p class="font-semibold">Couldn’t load the institution</p><p class="mt-0.5">{{ loadError() }}</p></div>
          <button type="button" class="btn btn-outline btn-sm" (click)="load()">Try again</button>
        </div>
      } @else {
        @if (isNew()) {
          <div class="alert alert-info" role="status">
            <app-icon name="building" class="mt-0.5 h-4 w-4" />
            <p>The institution hasn’t been set up yet. Save this form to create it.</p>
          </div>
        }

        <form class="card max-w-2xl" (ngSubmit)="save()" novalidate>
          <div class="space-y-5 p-6">
            <div class="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <div class="field">
                <label class="field-label" for="in-code">Code</label>
                <input id="in-code" name="institutionCode" class="field-input uppercase" [class.field-invalid]="errors()['institutionCode']"
                       [(ngModel)]="form.institutionCode" maxlength="12" autocomplete="off"
                       [attr.aria-invalid]="!!errors()['institutionCode']" [attr.aria-describedby]="errors()['institutionCode'] ? 'in-code-err' : null" />
                @if (errors()['institutionCode']) { <p class="field-error" id="in-code-err">{{ errors()['institutionCode'] }}</p> }
              </div>
              <div class="field">
                <label class="field-label" for="in-name">Name</label>
                <input id="in-name" name="institutionName" class="field-input" [class.field-invalid]="errors()['institutionName']"
                       [(ngModel)]="form.institutionName" maxlength="200" autocomplete="off"
                       [attr.aria-invalid]="!!errors()['institutionName']" [attr.aria-describedby]="errors()['institutionName'] ? 'in-name-err' : null" />
                @if (errors()['institutionName']) { <p class="field-error" id="in-name-err">{{ errors()['institutionName'] }}</p> }
              </div>
            </div>

            <div class="field">
              <label class="field-label" for="in-domains">Email domains</label>
              <input id="in-domains" name="emailDomains" class="field-input" [class.field-invalid]="domainError()"
                     [(ngModel)]="domainsText" placeholder="wit.edu" autocomplete="off"
                     [attr.aria-invalid]="!!domainError()" [attr.aria-describedby]="domainError() ? 'in-domains-err' : 'in-domains-help'" />
              @if (domainError()) { <p class="field-error" id="in-domains-err">{{ domainError() }}</p> }
              @else { <p class="field-help" id="in-domains-help">Separate several domains with commas. New accounts must use one of them.</p> }
            </div>

            <div class="field max-w-xs">
              <label class="field-label" for="in-status">Status</label>
              <select id="in-status" name="status" class="field-select" [(ngModel)]="form.status">
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            @if (message()) {
              <div class="alert alert-error" role="alert">
                <app-icon name="alert" class="mt-0.5 h-4 w-4" />
                <p>{{ message() }}</p>
              </div>
            }
            @if (saved()) {
              <div class="alert alert-info" role="status">
                <app-icon name="check" class="mt-0.5 h-4 w-4" [stroke]="2" />
                <p>Institution saved.</p>
              </div>
            }
          </div>
          <div class="flex justify-end border-t border-line px-6 py-4">
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              @if (saving()) { <span class="spinner"></span> Saving… } @else { {{ isNew() ? 'Create institution' : 'Save changes' }} }
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class InstitutionSetupComponent {
  private readonly api = inject(AdminService);

  form: InstitutionUpdate = { institutionCode: '', institutionName: '', emailDomains: [], status: 'ACTIVE' };
  domainsText = '';

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly isNew = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errors = signal<Record<string, string>>({});
  readonly message = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.institution().subscribe({
      next: i => {
        this.form = { institutionCode: i.institutionCode, institutionName: i.institutionName, emailDomains: i.emailDomains, status: i.status };
        this.domainsText = i.emailDomains.join(', ');
        this.isNew.set(false);
        this.loading.set(false);
      },
      error: (e: WorkspaceError) => {
        // 404: not set up yet, so the form creates it.
        if (e.status === 404) this.isNew.set(true);
        else this.loadError.set(e.message);
        this.loading.set(false);
      },
    });
  }

  /** The first per-domain error ("emailDomains[1]") or the list's own. */
  domainError(): string | undefined {
    const errs = this.errors();
    return errs['emailDomains'] ?? Object.entries(errs).find(([k]) => k.startsWith('emailDomains['))?.[1];
  }

  save(): void {
    this.saving.set(true);
    this.saved.set(false);
    this.errors.set({});
    this.message.set(null);
    const emailDomains = this.domainsText.split(',').map(d => d.trim()).filter(Boolean);
    this.api.saveInstitution({ ...this.form, emailDomains }).subscribe({
      next: i => {
        this.form = { institutionCode: i.institutionCode, institutionName: i.institutionName, emailDomains: i.emailDomains, status: i.status };
        this.domainsText = i.emailDomains.join(', ');
        this.isNew.set(false);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (e: WorkspaceError) => {
        this.saving.set(false);
        if (e.fieldErrors) this.errors.set(e.fieldErrors);
        else this.message.set(e.message);
      },
    });
  }
}
