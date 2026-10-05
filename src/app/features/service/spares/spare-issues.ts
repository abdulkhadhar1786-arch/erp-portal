import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { InventoryItem, InventoryService } from '../../../core/services/inventory.service';
import { SpareIssue, SpareRequest, SpareService } from '../../../core/services/spare.service';

@Component({
  selector: 'app-spare-issues',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './spare-issues.html'
})
export class SpareIssues implements OnInit {
  requests: SpareRequest[] = [];
  issues: SpareIssue[] = [];
  items: InventoryItem[] = [];
  quantities: Record<string, number> = {};
  notes: Record<string, string> = {};
  loading = true;
  busyId = '';
  errorMessage = '';
  notice = '';

  constructor(private spares: SpareService, private inventoryApi: InventoryService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({ requests: this.spares.getRequests(), issues: this.spares.getIssues(), inventory: this.inventoryApi.getItems() }).subscribe({
      next: ({ requests, issues, inventory }) => {
        this.requests = requests.requests ?? [];
        this.issues = issues.issues ?? [];
        this.items = inventory.items ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load spare issue records.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get pendingRequests(): SpareRequest[] {
    return this.requests.filter(request => request.status === 'Requested' || request.status === 'Partially Issued');
  }

  get issueValue(): number {
    return this.issues.reduce((sum, issue) => sum + issue.quantity * issue.unitCost, 0);
  }

  remaining(request: SpareRequest): number { return Math.max(0, request.quantityRequested - request.quantityIssued); }

  stockFor(request: SpareRequest): number {
    return this.items.find(item => item._id === request.inventoryItemId)?.quantityOnHand ?? 0;
  }

  issue(request: SpareRequest): void {
    if (this.busyId) return;
    const quantity = Number(this.quantities[request._id] ?? this.remaining(request));
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > this.remaining(request)) {
      this.errorMessage = 'Enter a positive quantity no greater than the remaining request.';
      return;
    }
    this.busyId = request._id;
    this.errorMessage = '';
    this.notice = '';
    this.spares.issueRequest(request._id, quantity, this.notes[request._id] ?? '').subscribe({
      next: ({ issue, request: updated }) => {
        this.requests = this.requests.map(existing => existing._id === updated._id ? updated : existing);
        this.issues = [issue, ...this.issues];
        const item = this.items.find(existing => existing._id === issue.inventoryItemId);
        if (item) item.quantityOnHand = Math.max(0, item.quantityOnHand - issue.quantity);
        delete this.quantities[request._id];
        delete this.notes[request._id];
        this.notice = `${issue.issueNumber} issued for ${issue.ticketNumber}. Stock has been updated.`;
        this.busyId = '';
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to issue this spare.';
        this.busyId = '';
        this.cdr.markForCheck();
      }
    });
  }

  reject(request: SpareRequest): void {
    if (this.busyId || request.status !== 'Requested') return;
    this.busyId = request._id;
    this.errorMessage = '';
    this.spares.rejectRequest(request._id).subscribe({
      next: ({ request: updated }) => {
        this.requests = this.requests.map(existing => existing._id === updated._id ? updated : existing);
        this.notice = `${updated.requestNumber} was rejected.`;
        this.busyId = '';
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to reject this request.';
        this.busyId = '';
        this.cdr.markForCheck();
      }
    });
  }
}
