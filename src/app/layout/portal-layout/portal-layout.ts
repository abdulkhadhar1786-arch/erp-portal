import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PortalRole } from '../../core/services/portal.service';
import { AppTheme, ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './portal-layout.html'
})
export class PortalLayout {
  constructor(private auth: AuthService, private router: Router, private themeService: ThemeService) {}

  get themeMode(): AppTheme {
    return this.themeService.theme;
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  get role(): PortalRole {
    return this.router.url.startsWith('/portal/branch') ? 'branch' : 'customer_admin';
  }

  get basePath(): string {
    return this.role === 'branch' ? '/portal/branch' : '/portal/customer';
  }

  get portalTitle(): string {
    return this.role === 'branch' ? 'Branch Office' : 'Customer Portal';
  }

  signOut(): void {
    this.auth.logout().subscribe({ complete: () => void this.router.navigateByUrl('/login') });
  }
}
