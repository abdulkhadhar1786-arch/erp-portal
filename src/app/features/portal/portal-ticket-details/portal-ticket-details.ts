import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PortalRole, PortalService, PortalTicket } from '../../../core/services/portal.service';

@Component({
  selector: 'app-portal-ticket-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portal-ticket-details.html'
})
export class PortalTicketDetails implements OnInit {
  readonly role: PortalRole;
  ticket?: PortalTicket;
  errorMessage = '';
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private portal: PortalService,
    private cdr: ChangeDetectorRef
  ) {
    this.role = this.route.snapshot.data['portalRole'] as PortalRole;
  }

  get basePath(): string { return this.role === 'branch' ? '/portal/branch' : '/portal/customer'; }

  get timeline() {
    if (this.ticket?.history?.length) {
      return [...this.ticket.history].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      );
    }
    if (!this.ticket) return [];
    return [{
      type: 'created' as const,
      title: 'Ticket submitted',
      description: 'Your service request was received.',
      actorName: 'Requester',
      actorRole: this.role,
      createdAt: this.ticket.createdAt
    }];
  }

  ngOnInit(): void {
    const id = this.routeId;
    this.portal.getTicket(this.role, id).subscribe({
      next: response => { this.ticket = response.ticket; this.loading = false; this.cdr.markForCheck(); },
      error: error => { this.errorMessage = error?.error?.message ?? 'Unable to load ticket.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }

  private get routeId(): string { return this.route.snapshot.paramMap.get('id') ?? ''; }
}
