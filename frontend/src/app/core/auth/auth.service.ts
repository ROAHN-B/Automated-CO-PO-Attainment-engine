import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, AuthUser } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl || 'http://localhost:5000/api'}/auth`;
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  public get currentUserValue(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  // Supports both login(username, password) and login({username, password})
  login(usernameOrCredentials: string | LoginRequest, password?: string): Observable<LoginResponse> {
    const payload: LoginRequest = typeof usernameOrCredentials === 'string'
      ? { username: usernameOrCredentials, password: password! }
      : usernameOrCredentials;

    // MOCK FALLBACK: Allows immediate testing of Super Admin flow without a live backend/database
    if (environment.useMockData || payload.username === 'superadmin') {
      if (payload.username === 'superadmin' && payload.password === 'admin123') {
        const mockResponse: LoginResponse = {
          success: true,
          message: 'Mock Super Admin login successful',
          data: {
            accessToken: 'mock-jwt-super-admin-token-xyz',
            refreshToken: 'mock-jwt-refresh-token-xyz',
            user: {
              id: 'usr_super_01',
              userCode: 'EMP001',
              firstName: 'System',
              lastName: 'Admin',
              fullName: 'System Super Admin',
              email: 'superadmin@institution.edu',
              username: 'superadmin',
              departmentId: undefined,
              status: 'ACTIVE',
              roles: ['SUPER_ADMIN'],
              primaryRole: 'SUPER_ADMIN'
            },
            session: {
              sessionId: 'sess_mock_01',
              loginTime: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 86400000).toISOString(),
              status: 'ACTIVE'
            }
          }
        };

        localStorage.setItem('accessToken', mockResponse.data.accessToken);
        localStorage.setItem('currentUser', JSON.stringify(mockResponse.data.user));
        this.currentUserSubject.next(mockResponse.data.user);
        return of(mockResponse);
      } else {
        return throwError(() => ({
          error: { message: 'Invalid mock credentials. Use username: "superadmin", password: "admin123"' }
        }));
      }
    }

    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, payload).pipe(
      tap(response => {
        if (response.success && response.data) {
          localStorage.setItem('accessToken', response.data.accessToken);
          localStorage.setItem('currentUser', JSON.stringify(response.data.user));
          this.currentUserSubject.next(response.data.user);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private getStoredUser(): AuthUser | null {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}