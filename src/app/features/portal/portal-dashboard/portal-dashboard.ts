import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PortalDashboard as DashboardData, PortalRole, PortalService } from '../../../core/services/portal.service';

@Component({
  selector: 'app-portal-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portal-dashboard.html'
})
export class PortalDashboard implements OnInit {
  readonly role: PortalRole;
  data?: DashboardData;
  errorMessage = '';
  loading = true;

  constructor(route: ActivatedRoute, private portal: PortalService, private cdr: ChangeDetectorRef) {
    this.role = route.snapshot.data['portalRole'] as PortalRole;
  }

  get basePath(): string {
    return this.role === 'branch' ? '/portal/branch' : '/portal/customer';
  }

  get accountMeta(): string {
    if (!this.data) return '';
    const parts = this.role === 'branch'
      ? [this.data.account.customer, this.data.account.customerCode, this.data.account.city]
      : [this.data.account.code, this.data.account.city];
    return parts.filter((part): part is string => !!part?.trim()).join(' · ');
  }

  ticketStatusClass(status: string): string {
    if (status === 'Resolved' || status === 'Closed') return 'bg-emerald-50 text-emerald-700';
    if (status === 'New') return 'bg-sky-50 text-sky-700';
    return 'bg-amber-50 text-amber-800';
  }

  ngOnInit(): void {
    this.portal.getDashboard(this.role).subscribe({
      next: data => { this.data = data; this.loading = false; this.cdr.markForCheck(); },
      error: error => { this.errorMessage = error?.error?.message ?? 'Unable to load dashboard.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }
}
