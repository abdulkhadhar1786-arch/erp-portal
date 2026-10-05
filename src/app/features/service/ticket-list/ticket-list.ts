import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild,
  OnInit
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';

import {
  Ticket,
  TicketService
} from '../../../core/services/ticket.service';
import { TicketDetails } from '../ticket-details/ticket-details';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TicketDetails
  ],
  templateUrl: './ticket-list.html'
})
export class TicketList implements OnInit {

  @ViewChild('ticketDialog') ticketDialog?: ElementRef<HTMLDialogElement>;

  searchText = '';

  customerFilter = '';
  branchFilter = '';
  statusFilter = '';
  priorityFilter = '';

  tickets: Ticket[] = [];
  selectedTicketId = '';

  loading = true;

  errorMessage = '';

  constructor(
    private ticketService: TicketService,
    private route: ActivatedRoute,
    private router: Router,
    private changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {

    this.route.queryParamMap.subscribe(params => {

      this.customerFilter =
        params.get('customerId') ?? '';

      this.branchFilter =
        params.get('branchId') ?? '';

      this.statusFilter = params.get('status') ?? '';
      this.priorityFilter = params.get('priority') ?? '';
      this.searchText = params.get('q') ?? '';

      this.loadTickets();

    });

  }

  loadTickets(): void {

    this.loading = true;
    this.errorMessage = '';

    this.ticketService
      .getTickets()
      .subscribe({

        next: response => {
          this.tickets =
            response.tickets ?? [];

          this.loading = false;
          this.changeDetector.markForCheck();

        },

        error: error => {

          console.error(
            'Ticket API error:',
            error
          );

          this.tickets = [];

          this.loading = false;

          this.errorMessage =
            error?.error?.message ??
            error?.message ??
            'Unable to load tickets.';

          this.changeDetector.markForCheck();

        }

      });

  }

  get filteredTickets(): Ticket[] {

    const search =
      this.searchText
        .trim()
        .toLowerCase();

    return this.tickets.filter(ticket => {

      const matchesSearch =
        !search ||
        [
          ticket.ticketNumber,
          ticket.subject,
          ticket.customerName,
          ticket.branchName,
          ticket.category,
          ticket.reportedBy,
          ticket.contactEmail,
          ticket.assetReference
        ].some(value => String(value ?? '').toLowerCase().includes(search));

      const matchesCustomer =
        !this.customerFilter ||
        ticket.customerId ===
          this.customerFilter;

      const matchesBranch =
        !this.branchFilter ||
        ticket.branchId ===
          this.branchFilter;

      const matchesStatus =
        !this.statusFilter ||
        ticket.status ===
          this.statusFilter;

      const matchesPriority =
        !this.priorityFilter ||
        ticket.priority ===
          this.priorityFilter;

      return (
        matchesSearch &&
        matchesCustomer &&
        matchesBranch &&
        matchesStatus &&
        matchesPriority
      );

    });

  }

  get customers(): {
    id: string;
    name: string;
  }[] {

    const map =
      new Map<string, string>();

    this.tickets.forEach(ticket => {

      map.set(
        ticket.customerId,
        ticket.customerName
      );

    });

    return Array.from(
      map.entries()
    ).map(([id, name]) => ({
      id,
      name
    }));

  }

  get branches(): {
    id: string;
    name: string;
  }[] {

    const source =
      this.customerFilter
        ? this.tickets.filter(
            ticket =>
              ticket.customerId ===
              this.customerFilter
          )
        : this.tickets;

    const map =
      new Map<string, string>();

    source.forEach(ticket => {

      map.set(
        ticket.branchId,
        ticket.branchName
      );

    });

    return Array.from(
      map.entries()
    ).map(([id, name]) => ({
      id,
      name
    }));

  }

  get totalTickets(): number {
    return this.tickets.length;
  }

  get newTickets(): number {

    return this.tickets.filter(
      ticket =>
        ticket.status === 'New'
    ).length;

  }

  get activeTickets(): number {

    return this.tickets.filter(
      ticket =>
        ticket.status === 'Assigned' ||
        ticket.status === 'In Progress' ||
        ticket.status === 'On Hold'
    ).length;

  }

  get resolvedTickets(): number {

    return this.tickets.filter(
      ticket =>
        ticket.status === 'Resolved' ||
        ticket.status === 'Closed'
    ).length;

  }

  onCustomerChange(): void {

    this.branchFilter = '';

  }

  clearFilters(): void {

    this.searchText = '';
    this.customerFilter = '';
    this.branchFilter = '';
    this.statusFilter = '';
    this.priorityFilter = '';

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null, status: null, priority: null, customerId: null, branchId: null },
      queryParamsHandling: 'merge'
    });

  }

  openTicketDetails(ticketId: string): void {
    this.selectedTicketId = ticketId;
    this.changeDetector.detectChanges();

    const dialog = this.ticketDialog?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }

  closeTicketDetails(): void {
    if (!this.selectedTicketId) return;

    const dialog = this.ticketDialog?.nativeElement;
    if (dialog?.open) dialog.close();

    this.selectedTicketId = '';
    this.loadTickets();
  }

  onTicketDialogClick(event: MouseEvent): void {
    if (event.target === this.ticketDialog?.nativeElement) {
      this.closeTicketDetails();
    }
  }

  onTicketDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeTicketDetails();
  }

}
