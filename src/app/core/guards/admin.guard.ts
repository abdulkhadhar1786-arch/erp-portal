import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';
import {
  catchError,
  map,
  of
} from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getSession().pipe(
    map(session => session.role === 'admin' ? true : router.createUrlTree(['/login'])),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};

export function portalGuard(role: 'customer_admin' | 'branch'): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    return authService.getSession().pipe(
      map(session => session.role === role
        ? true
        : router.createUrlTree(['/login'])),
      catchError(() => of(router.createUrlTree(['/login'])))
    );
  };
}
