import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Adds the access token to every request; a 401 on any call but sign-in/out ends the session. */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      const signInOrOut = /\/auth\/(login|logout)$/.test(req.url);
      if (err instanceof HttpErrorResponse && err.status === 401 && !signInOrOut) authService.logout();
      return throwError(() => err);
    }),
  );
};
