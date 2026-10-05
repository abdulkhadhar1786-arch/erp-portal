import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, TimeoutError, timeout } from 'rxjs';
import { AuthResponse, AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html'
})
export class Login implements OnInit {
  username = '';
  password = '';
  errorMessage = '';
  isSubmitting = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.getSession().subscribe({
      next: session => {
        if (session.role === 'engineer') {
          this.errorMessage = 'Engineer accounts sign in through the Service Hub mobile app.';
          return;
        }
        void this.router.navigateByUrl(this.dashboardFor(session.role));
      },
      error: () => undefined
    });
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    this.authService.login(this.username, this.password)
      .pipe(
        timeout({ first: 15000 }),
        finalize(() => this.isSubmitting = false)
      )
      .subscribe({
        next: session => {
          if (session.role === 'engineer') {
            this.errorMessage = 'Engineer accounts sign in through the Service Hub mobile app.';
            return;
          }
          void this.router.navigateByUrl(this.dashboardFor(session.role));
        },
        error: (error: unknown) => {
          if (error instanceof TimeoutError) {
            this.errorMessage = 'The sign-in service did not respond. Try again.';
          } else if (error instanceof HttpErrorResponse && error.status === 503) {
            this.errorMessage = 'Sign-in is not configured on the server.';
          } else if (error instanceof HttpErrorResponse && error.status === 429) {
            this.errorMessage = 'Too many attempts. Try again later.';
          } else if (error instanceof HttpErrorResponse && error.status === 409) {
            this.errorMessage = 'This sign-in matches multiple accounts. Contact your administrator.';
          } else if (error instanceof HttpErrorResponse && error.status === 401) {
            this.errorMessage = 'The email or username and password do not match.';
          } else {
            this.errorMessage = 'Unable to reach the sign-in service. Try again.';
          }
        }
      });
  }

  private dashboardFor(role: Exclude<AuthResponse['role'], 'engineer'>): string {
    return role === 'admin'
      ? '/admin/dashboard'
      : role === 'customer_admin'
        ? '/portal/customer/dashboard'
        : '/portal/branch/dashboard';
  }
}
