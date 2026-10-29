import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FacultyCreate, FacultyField, FacultyMember } from '../../../core/models/coordination.model';
import { CoordinationService } from '../../../core/services/coordination.service';
import { WorkspaceError } from '../../../core/services/faculty-workspace.service';
import { BodyPortalDirective } from '../../../shared/ui/body-portal.directive';
import { IconComponent } from '../../../shared/ui/icon.component';

/**
 * Add or edit one faculty member (CRD-2, CRD-3). The server validates every
 * field; its messages are shown next to the matching inputs.
 */
@Component({
  selector: 'app-faculty-form-dialog',
  standalone: true,
  imports: [FormsModule, IconComponent, BodyPortalDirective],
  template: `
    <div class="modal-backdrop" appBodyPortal (click)="close()">
      <form class="modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="ff-title"
            (click)="$event.stopPropagation()" (ngSubmit)="save()" novalidate>
        <div class="space-y-5 p-6">
          <div>
            <h3 id="ff-title" class="font-serif text-2xl font-light text-ink">{{ member() ? 'Edit ' + member()!.fullName : 'Add a faculty member' }}</h3>
            <p class="mt-1.5 text-sm text-ink-soft">{{ member() ? 'Changes apply to every semester.' : 'They get their sign-in link with their first allocation email.' }}</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            @for (f of nameFields; track f.key) {
              <div class="field">
                <label class="field-label" [for]="'ff-' + f.key">{{ f.label }}</label>
                <input [id]="'ff-' + f.key" [name]="f.key" class="field-input" [class.field-invalid]="errors()[f.key]"
                       [(ngModel)]="form[f.key]" [attr.aria-invalid]="!!errors()[f.key]" [attr.aria-describedby]="errors()[f.key] ? 'ff-' + f.key + '-err' : null"
                       autocomplete="off" maxlength="60" />
                @if (errors()[f.key]) { <p class="field-error" [id]="'ff-' + f.key + '-err'">{{ errors()[f.key] }}</p> }
              </div>
            }
          </div>

          <div class="field">
            <label class="field-label" for="ff-email">College email</label>
            <input id="ff-email" name="email" type="email" class="field-input" [class.field-invalid]="errors()['email']"
                   [(ngModel)]="form.email" placeholder="name@wit.edu" autocomplete="off"
                   [attr.aria-invalid]="!!errors()['email']" [attr.aria-describedby]="errors()['email'] ? 'ff-email-err' : null" />
            @if (errors()['email']) { <p class="field-error" id="ff-email-err">{{ errors()['email'] }}</p> }
          </div>

          <div class="field">
            <label class="field-label" for="ff-phone">Phone number</label>
            <input id="ff-phone" name="phone" type="tel" class="field-input" [class.field-invalid]="errors()['phone']"
                   [(ngModel)]="form.phone" placeholder="98765 43210" autocomplete="off"
                   [attr.aria-invalid]="!!errors()['phone']" [attr.aria-describedby]="errors()['phone'] ? 'ff-phone-err' : 'ff-phone-help'" />
            @if (errors()['phone']) { <p class="field-error" id="ff-phone-err">{{ errors()['phone'] }}</p> }
            @else { <p class="field-help" id="ff-phone-help">10-digit mobile number; +91 is optional.</p> }
          </div>

          @if (message()) {
            <div class="alert alert-error" role="alert">
              <app-icon name="alert" class="mt-0.5 h-4 w-4" />
              <p>{{ message() }}</p>
            </div>
          }
        </div>
        <div class="flex justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" class="btn btn-ghost" [disabled]="saving()" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> Saving… } @else { {{ member() ? 'Save changes' : 'Add faculty member' }} }
          </button>
        </div>
      </form>
    </div>
  `,
})
export class FacultyFormDialogComponent implements OnInit {
  private readonly api = inject(CoordinationService);

  /** The member to edit; absent to add a new one. */
  readonly member = input<FacultyMember | null>(null);
  readonly saved = output<FacultyMember>();
  readonly closed = output<void>();

  readonly nameFields: { key: 'firstName' | 'lastName'; label: string }[] = [
    { key: 'firstName', label: 'First name' },
    { key: 'lastName', label: 'Last name' },
  ];

  form: FacultyCreate = { firstName: '', lastName: '', email: '', phone: '' };
  readonly saving = signal(false);
  readonly errors = signal<Partial<Record<FacultyField | string, string>>>({});
  readonly message = signal<string | null>(null);

  ngOnInit(): void {
    const m = this.member();
    if (m) this.form = { firstName: m.firstName, lastName: m.lastName, email: m.email, phone: m.phone };
  }

  close(): void {
    if (!this.saving()) this.closed.emit();
  }

  save(): void {
    const m = this.member();
    this.saving.set(true);
    this.errors.set({});
    this.message.set(null);
    const req$ = m ? this.api.updateFaculty(m.userId, { ...this.form }) : this.api.createFaculty({ ...this.form });
    req$.subscribe({
      next: f => { this.saving.set(false); this.saved.emit(f); },
      error: (e: WorkspaceError) => {
        this.saving.set(false);
        if (e.fieldErrors) this.errors.set(e.fieldErrors);
        else this.message.set(e.message);
      },
    });
  }
}
