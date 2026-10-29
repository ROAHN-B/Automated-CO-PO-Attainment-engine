import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { delay, map, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApiResponse, IsoDateTime } from '../models/common.model';

/** API_CONTRACT §5 SessionUser (the fields the app uses). */
interface SessionUser {
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
  primaryRole: string;
}

/** API_CONTRACT §5 LoginResult. */
interface LoginResult {
  accessToken: string;
  expiresAt: IsoDateTime;
  user: SessionUser;
}

/** Demo accounts for mock mode only; all use the password `password123`. */
const MOCK_ACCOUNTS: Record<string, SessionUser & { token: string }> = {
  'faculty@wit.edu': {
    token: 'mock-jwt-token-faculty', primaryRole: 'FACULTY', roles: ['FACULTY'],
    userId: 'user-fac-001', fullName: 'Rohan Belsare', email: 'faculty@wit.edu',
  },
  'coordinator@wit.edu': {
    token: 'mock-jwt-token-coordinator', primaryRole: 'COORDINATOR', roles: ['FACULTY', 'COORDINATOR'],
    userId: 'user-crd-001', fullName: 'Sneha Kulkarni', email: 'coordinator@wit.edu',
  },
  'hod.ecm@wit.edu': {
    token: 'mock-jwt-token-hod', primaryRole: 'HOD', roles: ['HOD'],
    userId: 'user-hod-001', fullName: 'Head of Department', email: 'hod.ecm@wit.edu',
  },
  'superadmin@wit.edu': {
    token: 'mock-jwt-token-admin', primaryRole: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'],
    userId: 'user-admin-001', fullName: 'Super Admin', email: 'superadmin@wit.edu',
  },
};

const SESSION_KEYS = ['token', 'user_role', 'user_roles', 'user_name', 'user_email'];

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private readonly live = environment.liveAreas.includes('auth');
  private readonly base = environment.apiBaseUrl;

  /** AUTH-1. Emits the user's primary role, which decides the landing page. */
  login(username: string, password: string): Observable<string> {
    if (this.live) {
      return this.http.post<ApiResponse<LoginResult>>(`${this.base}/auth/login`, { username, password }).pipe(
        tap(res => this.setSession(res.data.accessToken, res.data.user)),
        map(res => res.data.user.primaryRole),
      );
    }

    const account = MOCK_ACCOUNTS[username.trim().toLowerCase()];
    if (account && password === 'password123') {
      return of(account).pipe(
        delay(600),
        tap(a => this.setSession(a.token, a)),
        map(a => a.primaryRole),
      );
    }
    return throwError(() => new Error('Invalid email or password')).pipe(delay(600));
  }

  /**
   * AUTH-4 on app start: refreshes the stored roles and name from the server, so a
   * role edited in the browser is never trusted. A rejected token signs out (via the
   * interceptor); an unreachable server keeps the stored session.
   */
  async restore(): Promise<void> {
    const token = this.getToken();
    if (!this.live || !token) return;
    try {
      const res = await firstValueFrom(this.http.get<ApiResponse<SessionUser>>(`${this.base}/auth/me`));
      this.setSession(token, res.data);
    } catch { /* handled by the interceptor or offline */ }
  }

  getDashboardRouteForRole(role: string | null): string {
    switch (role) {
      case 'SUPER_ADMIN': return '/admin/dashboard';
      case 'COORDINATOR': return '/faculty/coordination';
      case 'FACULTY': return '/faculty/dashboard';
      case 'HOD': return '/analytics/hod-dashboard';
      default: return '/login';
    }
  }

  private setSession(token: string, user: SessionUser): void {
    localStorage.setItem('token', token);
    localStorage.setItem('user_role', user.primaryRole);
    localStorage.setItem('user_roles', JSON.stringify(user.roles));
    localStorage.setItem('user_name', user.fullName);
    localStorage.setItem('user_email', user.email);
  }

  getToken(): string | null {
    return this.read('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** The primary role, which decides the landing page. */
  primaryRole(): string | null {
    return this.read('user_role');
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
    // AUTH-3; tokens are stateless, so a failed call changes nothing.
    if (this.live && this.getToken()) this.http.post(`${this.base}/auth/logout`, null).subscribe({ error: () => {} });
    for (const key of SESSION_KEYS) {
      try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
    }
    this.router.navigate(['/login']);
  }

  private read(key: string): string | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key); } catch { return null; }
  }
}
