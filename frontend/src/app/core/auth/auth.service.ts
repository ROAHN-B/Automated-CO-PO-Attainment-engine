import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type UserRole = 'SUPER_ADMIN' | 'HOD' | 'FACULTY' | 'LAB_ASSISTANT';

export interface UserSession {
  token: string;
  role: UserRole;
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl || 'http://localhost:5000/api'}/auth`;

  private readonly TOKEN_KEY = 'obe_auth_token';
  private readonly USER_KEY = 'obe_user_session';

  /**
   * Authenticates user against institutional credentials and returns role metadata.
   */
  login(email: string, pass: string): Observable<UserSession> {
    if (environment.useMockData) {
      let role: UserRole = 'FACULTY';
      let name = 'Course Faculty';

      if (email.includes('super') || email.includes('admin')) {
        role = 'SUPER_ADMIN';
        name = 'Super Administrator';
      } else if (email.includes('hod')) {
        role = 'HOD';
        name = 'Head of Department';
      } else if (email.includes('lab')) {
        role = 'LAB_ASSISTANT';
        name = 'Lab Assistant';
      }

      const mockSession: UserSession = {
        token: 'mock_jwt_token_' + Date.now(),
        role,
        name,
        email
      };

      return of(mockSession).pipe(
        delay(600),
        tap(session => this.setSession(session))
      );
    }

    return this.http.post<UserSession>(`${this.apiUrl}/login`, { email, pass }).pipe(
      tap(session => this.setSession(session))
    );
  }

  private setSession(session: UserSession): void {
    localStorage.setItem(this.TOKEN_KEY, session.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(session));
  }

  /**
   * Returns the stored JWT token for the HTTP interceptor.
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): UserSession | null {
    const data = localStorage.getItem(this.USER_KEY);
    return data ? JSON.parse(data) : null;
  }

  getUserRole(): UserRole | null {
    const user = this.getCurrentUser();
    return user ? user.role : null;
  }

  /**
   * Determines the exact landing route based on the user's role.
   */
  getDashboardRouteForRole(role: UserRole): string {
    switch (role) {
      case 'SUPER_ADMIN':
        return '/admin/dashboard';
      case 'HOD':
        return '/analytics/hod-dashboard';
      case 'FACULTY':
        return '/faculty/dashboard';
      case 'LAB_ASSISTANT':
        return '/lab/dashboard';
      default:
        return '/login';
    }
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}