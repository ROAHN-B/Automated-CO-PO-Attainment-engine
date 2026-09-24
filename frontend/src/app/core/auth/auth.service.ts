import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);

  constructor() {}

  login(email: string, password: string): Observable<any> {
    
    // 1. Lab Assistant Mock Auth
    if (email === 'labassistant@wit.edu' && password === 'password123') {
      return of({
        token: 'mock-jwt-token-lab-assistant',
        role: 'LAB_ASSISTANT',
        user: { userId: 'user-lab-001', fullName: 'Lab Assistant', email: 'labassistant@wit.edu' }
      }).pipe(
        delay(600),
        tap(res => this.setSession(res))
      );
    }

    // 2. Faculty Mock Auth
    if (email === 'faculty@wit.edu' && password === 'password123') {
      return of({
        token: 'mock-jwt-token-faculty',
        role: 'FACULTY',
        user: { userId: 'user-fac-001', fullName: 'Faculty Member', email: 'faculty@wit.edu' }
      }).pipe(
        delay(600),
        tap(res => this.setSession(res))
      );
    }

    // 3. HOD Mock Auth
    if (email === 'hod.ecm@wit.edu' && password === 'password123') {
      return of({
        token: 'mock-jwt-token-hod',
        role: 'HOD',
        user: { userId: 'user-hod-001', fullName: 'Head of Department', email: 'hod.ecm@wit.edu' }
      }).pipe(
        delay(600),
        tap(res => this.setSession(res))
      );
    }

    // 4. Super Admin Mock Auth
    if (email === 'superadmin@wit.edu' && password === 'password123') {
      return of({
        token: 'mock-jwt-token-admin',
        role: 'SUPER_ADMIN',
        user: { userId: 'user-admin-001', fullName: 'Super Admin', email: 'superadmin@wit.edu' }
      }).pipe(
        delay(600),
        tap(res => this.setSession(res))
      );
    }

    // Fallback for invalid credentials
    return throwError(() => new Error('Invalid email or password')).pipe(delay(600));
  }

  getDashboardRouteForRole(role: string): string {
    switch (role) {
      case 'SUPER_ADMIN': return '/admin/dashboard';
      case 'FACULTY': return '/faculty/dashboard';
      case 'HOD': return '/analytics/hod-dashboard';
      case 'LAB_ASSISTANT': return '/lab-assistant/marks-upload';
      default: return '/login';
    }
  }

  private setSession(authResult: any): void {
    localStorage.setItem('token', authResult.token);
    localStorage.setItem('user_role', authResult.role);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    this.router.navigate(['/login']);
  }
}