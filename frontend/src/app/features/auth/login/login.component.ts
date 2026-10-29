import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = false;
  errorMessage = '';
  showPassword = false;
  private submitted = false;

  /** The three stages shown on the editorial panel. */
  readonly steps = [
    { title: 'Plan', text: 'Assessment plan and course articulation matrix.' },
    { title: 'Assess', text: 'Validated question papers and structured marksheets.' },
    { title: 'Attain', text: 'CO and PO attainment, ready for review.' },
  ];

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  /** Field errors appear once the user has left the field or tried to submit. */
  showError(name: 'email' | 'password'): boolean {
    const control = this.loginForm.get(name);
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  private loginError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return "Can't reach the server. Check your connection and try again.";
      if (err.error?.errorCode === 'ACCOUNT_LOCKED') return err.error.message;
      if (err.status >= 500) return 'Something went wrong on our side. Try again in a moment.';
    }
    return "That email and password don't match an account. Check them and try again.";
  }

  onSubmit(): void {
    this.submitted = true;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (role) => {
        this.isLoading = false;
        this.router.navigate([this.authService.getDashboardRouteForRole(role)]);
      },
      error: (err: unknown) => {
        this.isLoading = false;
        this.errorMessage = this.loginError(err);
      }
    });
  }
}
