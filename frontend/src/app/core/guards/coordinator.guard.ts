import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Keeps the Coordination screens to users holding the COORDINATOR role.
 * A convenience only: the server limits every §15 call to the coordinator's department.
 */
export const coordinatorGuard: CanActivateFn = () =>
  inject(AuthService).hasRole('COORDINATOR') || inject(Router).createUrlTree(['/faculty/dashboard']);
