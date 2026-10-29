import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

/** Mock login result. The real one is the contract's LoginResponse (§5). */
interface MockLogin {
  token: string;
  /** Primary role: decides the landing page. */
  role: string;
  /** Every role the user holds (§4.1). A coordinator always holds FACULTY too. */
  roles: string[];
  user: { userId: string; fullName: string; email: string };
}

/** Demo accounts for mock mode only; all use the password `password123`. */
const MOCK_ACCOUNTS: Record<string, MockLogin> = {
  'faculty@wit.edu': {
    token: 'mock-jwt-token-faculty', role: 'FACULTY', roles: ['FACULTY'],
    user: { userId: 'user-fac-001', fullName: 'Rohan Belsare', email: 'faculty@wit.edu' },
  },
  'coordinator@wit.edu': {
    token: 'mock-jwt-token-coordinator', role: 'COORDINATOR', roles: ['FACULTY', 'COORDINATOR'],
    user: { userId: 'user-crd-001', fullName: 'Sneha Kulkarni', email: 'coordinator@wit.edu' },
  },
  'hod.ecm@wit.edu': {
    token: 'mock-jwt-token-hod', role: 'HOD', roles: ['HOD'],
    user: { userId: 'user-hod-001', fullName: 'Head of Department', email: 'hod.ecm@wit.edu' },
  },
  'superadmin@wit.edu': {
    token: 'mock-jwt-token-admin', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'],
    user: { userId: 'user-admin-001', fullName: 'Super Admin', email: 'superadmin@wit.edu' },
  },
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);

  login(email: string, password: string): Observable<MockLogin> {
    const account = MOCK_ACCOUNTS[email.trim().toLowerCase()];
    if (account && password === 'password123') {
      return of(account).pipe(
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
      case 'COORDINATOR': return '/faculty/coordination';
      case 'FACULTY': return '/faculty/dashboard';
      case 'HOD': return '/analytics/hod-dashboard';
      default: return '/login';
    }
  }

  private setSession(authResult: MockLogin): void {
    localStorage.setItem('token', authResult.token);
    localStorage.setItem('user_role', authResult.role);
    localStorage.setItem('user_roles', JSON.stringify(authResult.roles));
    localStorage.setItem('user_name', authResult.user.fullName);
    localStorage.setItem('user_email', authResult.user.email);
  }

  getToken(): string | null {
    return this.read('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** Every role of the signed-in user. The server still checks each call. */
  roles(): string[] {
    try { return JSON.parse(this.read('user_roles') ?? '[]'); } catch { return []; }
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role) || this.read('user_role') === role;
  }

  /** The signed-in user's full name, if known. */
  userName(): string | null {
    return this.read('user_name');
  }

  logout(): void {
    for (const key of ['token', 'user_role', 'user_roles', 'user_name', 'user_email']) {
      try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
    }
    this.router.navigate(['/login']);
  }

  private read(key: string): string | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key); } catch { return null; }
  }
}
