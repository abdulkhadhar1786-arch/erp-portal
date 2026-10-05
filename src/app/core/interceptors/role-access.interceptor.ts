import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const roleAccessInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 403 &&
        request.url.includes('/api/') &&
        router.url.startsWith('/admin')
      ) {
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    })
  );
};
