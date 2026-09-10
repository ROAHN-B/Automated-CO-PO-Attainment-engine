import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const currentUser = authService.currentUserValue;

  // Retrieve the expected role defined in app.routes.ts data
  const expectedRole = route.data['expectedRole'] as string;

  if (!currentUser) {
    router.navigate(['/login']);
    return false;
  }

  // Verify if the user has the required role (checks primary role or roles list)
  const hasRole = 
    currentUser.primaryRole === expectedRole || 
    (currentUser.roles && currentUser.roles.includes(expectedRole));

  if (hasRole) {
    return true;
  }

  // Unauthorized role access: redirect safely to default dashboard
  router.navigate(['/faculty/dashboard']);
  return false;
};