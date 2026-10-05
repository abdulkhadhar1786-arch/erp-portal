import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { InventoryItem, InventoryService } from '../../../core/services/inventory.service';
import { SpareRequest, SpareService } from '../../../core/services/spare.service';
import { Ticket, TicketService } from '../../../core/services/ticket.service';

@Component({
  selector: 'app-spare-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './spare-requests.html'
})
export class SpareRequests implements OnInit {
  requests: SpareRequest[] = [];
  tickets: Ticket[] = [];
  items: InventoryItem[] = [];
  ticketId = '';
  inventoryItemId = '';
  quantity = 1;
  reason = '';
  loading = true;
  saving = false;
  errorMessage = '';
  notice = '';

  constructor(
    private spares: SpareService,
    private ticketsApi: TicketService,
    private inventoryApi: InventoryService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.ticketId = params.get('ticketId') ?? this.ticketId;
      this.cdr.markForCheck();
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      requests: this.spares.getRequests(),
      tickets: this.ticketsApi.getTickets(),
      inventory: this.inventoryApi.getItems()
    }).subscribe({
      next: ({ requests, tickets, inventory }) => {
        this.requests = requests.requests ?? [];
        this.tickets = (tickets.tickets ?? []).filter(ticket => ticket.status !== 'Resolved' && ticket.status !== 'Closed');
        this.items = (inventory.items ?? []).filter(item => item.status === 'Active');
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load spare requests.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get openRequests(): number {
    return this.requests.filter(request => request.status === 'Requested' || request.status === 'Partially Issued').length;
  }

  get availableItems(): InventoryItem[] {
    return this.items;
  }

  itemStock(itemId: string): number {
    return this.items.find(item => item._id === itemId)?.quantityOnHand ?? 0;
  }

  submit(): void {
    if (this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    this.notice = '';
    this.spares.createRequest({
      ticketId: this.ticketId,
      inventoryItemId: this.inventoryItemId,
      quantityRequested: Number(this.quantity),
      reason: this.reason.trim()
    }).subscribe({
      next: ({ request }) => {
        this.requests = [request, ...this.requests];
        this.inventoryItemId = '';
        this.quantity = 1;
        this.reason = '';
        this.notice = `${request.requestNumber} added to the issue queue.`;
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to submit this spare request.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  remaining(request: SpareRequest): number {
    return Math.max(0, request.quantityRequested - request.quantityIssued);
  }
}
