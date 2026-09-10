/**
 * API Contract for Authentication
 * Based on EPIC-001 Database Design (Collections: user, session, role, userRole)
 */

// 1. The payload sent to the backend when the user submits the login form
export interface LoginRequest {
  username: string; // Can be username or email
  password: string; // Plain text from form, backend will compare with passwordHash
}

// 2. The Identity Information extracted from the `user` collection
export interface AuthUser {
  id: string;             // Maps to CockroachDB `user.id` (UUID)
  userCode: string;       // Maps to employeeCode/userCode
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  username: string;
  departmentId?: string;  // Nullable for Super Admin
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED';
  
  // Extracted from the `userRole` mapping collection
  roles: string[];        // e.g., ['SUPER_ADMIN', 'FACULTY']
  primaryRole: string;    // The role where isPrimaryRole = true
}

// 3. The Session Information extracted from the `session` collection
export interface AuthSession {
  sessionId: string;
  loginTime: string;      // ISO Date string
  expiresAt: string;      // ISO Date string
  status: 'ACTIVE' | 'EXPIRED' | 'LOGGED_OUT' | 'REVOKED';
}

// 4. The final payload expected back from the backend upon successful login
export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;  // JWT Access Token
    refreshToken?: string; // JWT Refresh Token (Optional)
    user: AuthUser;       // Identity details
    session: AuthSession; // Session details
  }
}