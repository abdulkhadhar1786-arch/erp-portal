import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PortalRole, PortalService, PortalTicket } from '../../../core/services/portal.service';

@Component({
  selector: 'app-portal-ticket-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './portal-ticket-list.html'
})
export class PortalTicketList implements OnInit {
  readonly role: PortalRole;
  tickets: PortalTicket[] = [];
  statusFilter = 'All';
  loading = true;
  errorMessage = '';

  constructor(route: ActivatedRoute, private portal: PortalService, private cdr: ChangeDetectorRef) {
    this.role = route.snapshot.data['portalRole'] as PortalRole;
  }

  get basePath(): string { return this.role === 'branch' ? '/portal/branch' : '/portal/customer'; }
  get visibleTickets(): PortalTicket[] { return this.statusFilter === 'All' ? this.tickets : this.tickets.filter(ticket => ticket.status === this.statusFilter); }

  ticketStatusClass(status: string): string {
    if (status === 'Resolved' || status === 'Closed') return 'bg-emerald-50 text-emerald-700';
    if (status === 'New') return 'bg-sky-50 text-sky-700';
    return 'bg-amber-50 text-amber-800';
  }

  ngOnInit(): void {
    this.portal.getTickets(this.role).subscribe({
      next: response => { this.tickets = response.tickets; this.loading = false; this.cdr.markForCheck(); },
      error: error => { this.errorMessage = error?.error?.message ?? 'Unable to load tickets.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }
}
