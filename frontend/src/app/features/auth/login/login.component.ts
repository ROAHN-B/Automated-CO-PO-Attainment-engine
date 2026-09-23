import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
      <div class="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden p-8 space-y-8">
        
        <!-- Header -->
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-indigo-600 rounded-xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 class="text-2xl font-black text-slate-900 tracking-tight">OBE Engine Portal</h1>
          <p class="text-xs text-slate-500">Sign in to access your institutional workspace</p>
        </div>

        <!-- Error Message Banner -->
        <div *ngIf="errorMessage" class="bg-red-50 border border-red-200 text-red-600 text-xs p-3 rounded-lg text-center font-medium">
          {{ errorMessage }}
        </div>

        <!-- Login Form -->
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-5">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Institutional Email</label>
            <input 
              type="email" 
              formControlName="email"
              placeholder="e.g. faculty@wit.edu"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors">
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
            <input 
              type="password" 
              formControlName="password"
              placeholder="••••••••"
              class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors">
          </div>

          <button 
            type="submit" 
            [disabled]="isLoading || loginForm.invalid"
            class="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <span *ngIf="!isLoading">Sign In</span>
            <span *ngIf="isLoading" class="flex items-center gap-2">
              <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying credentials...
            </span>
          </button>
        </form>

      </div>
    </div>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = false;
  errorMessage = '';

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit(): void {
    if (this.loginForm.invalid) return;

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
        this.errorMessage = 'Invalid institutional email or password. Please try again.';
      }
    });
  }
}