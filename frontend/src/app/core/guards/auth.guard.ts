import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Keeps a portal to signed-in users holding `role`; anyone else goes to sign-in or
 * their own landing page. A convenience only: the server checks every call.
 */
export const portalGuard = (role: string): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  if (auth.hasRole(role)) return true;
  return router.parseUrl(auth.getDashboardRouteForRole(auth.primaryRole()));
};
