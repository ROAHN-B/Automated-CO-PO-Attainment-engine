import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
      next: (session) => {
        this.isLoading = false;
        const targetRoute = this.authService.getDashboardRouteForRole(session.role);
        this.router.navigate([targetRoute]);
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = "That email and password don't match an account. Check them and try again.";
      }
    });
  }
}
