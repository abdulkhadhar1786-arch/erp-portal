import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomerService } from '../../../core/services/customer.service';
import { Ticket, TicketPriority, TicketService, TicketStatus } from '../../../core/services/ticket.service';
import { InventoryItem, InventoryService } from '../../../core/services/inventory.service';
import { DefectiveReturn, SpareIssue, SpareRequest, SpareService } from '../../../core/services/spare.service';

interface CountRow {
  label: string;
  count: number;
  percent: number;
  value?: number;
}

@Component({
  selector: 'app-report-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './report-dashboard.html'
})
export class ReportDashboard implements OnInit {
  readonly statuses: TicketStatus[] = ['New', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed'];
  readonly priorities: TicketPriority[] = ['Critical', 'High', 'Medium', 'Low'];
  readonly ranges = [
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
    { label: 'Last 12 months', value: '365' },
    { label: 'All time', value: 'all' }
  ];
  selectedRange = '90';
  allTickets: Ticket[] = [];
  allRequests: SpareRequest[] = [];
  allIssues: SpareIssue[] = [];
  allReturns: DefectiveReturn[] = [];
  allInventory: InventoryItem[] = [];
  customerCount = 0;
  loading = true;
  errorMessage = '';
  lastUpdated = '';

  constructor(
    private ticketsApi: TicketService,
    private customersApi: CustomerService,
    private sparesApi: SpareService,
    private inventoryApi: InventoryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      tickets: this.ticketsApi.getTickets(),
      customers: this.customersApi.getCustomers(),
      requests: this.sparesApi.getRequests(),
      issues: this.sparesApi.getIssues(),
      returns: this.sparesApi.getReturns(),
      inventory: this.inventoryApi.getItems()
    }).subscribe({
      next: ({ tickets, customers, requests, issues, returns, inventory }) => {
        this.allTickets = tickets.tickets ?? [];
        this.customerCount = customers.customers?.length ?? 0;
        this.allRequests = requests.requests ?? [];
        this.allIssues = issues.issues ?? [];
        this.allReturns = returns.returns ?? [];
        this.allInventory = inventory.items ?? [];
        this.lastUpdated = new Date().toISOString();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load report data.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get tickets(): Ticket[] {
    if (this.selectedRange === 'all') return this.allTickets;
    const cutoff = Date.now() - Number(this.selectedRange) * 24 * 60 * 60 * 1000;
    return this.allTickets.filter(ticket => Date.parse(ticket.createdAt) >= cutoff);
  }

  private inPeriod<T extends { createdAt: string }>(records: T[]): T[] {
    if (this.selectedRange === 'all') return records;
    const cutoff = Date.now() - Number(this.selectedRange) * 24 * 60 * 60 * 1000;
    return records.filter(record => Date.parse(record.createdAt) >= cutoff);
  }

  get requests(): SpareRequest[] { return this.inPeriod(this.allRequests); }
  get issues(): SpareIssue[] { return this.inPeriod(this.allIssues); }
  get returns(): DefectiveReturn[] { return this.inPeriod(this.allReturns); }

  get openSpareRequests(): number {
    return this.requests.filter(request => request.status === 'Requested' || request.status === 'Partially Issued' || request.status === 'Issuing').length;
  }

  get issuedQuantity(): number {
    return this.issues.reduce((sum, issue) => sum + issue.quantity, 0);
  }

  get issuedValue(): number {
    return this.issues.reduce((sum, issue) => sum + issue.quantity * issue.unitCost, 0);
  }

  get returnsForInspection(): number {
    return this.returns.filter(record => record.status === 'Submitted').length;
  }

  get lowStockCount(): number {
    return this.allInventory.filter(item => item.status === 'Active' && item.quantityOnHand <= item.reorderLevel).length;
  }

  get requestRows(): CountRow[] {
    return this.rows(['Requested', 'Partially Issued', 'Issued', 'Rejected'].map(status => [
      status,
      this.requests.filter(request => request.status === status).length
    ]));
  }

  get issueItemRows(): CountRow[] {
    const itemMap = new Map<string, { count: number; value: number }>();
    for (const issue of this.issues) {
      const row = itemMap.get(issue.sku) ?? { count: 0, value: 0 };
      row.count += issue.quantity;
      row.value += issue.quantity * issue.unitCost;
      itemMap.set(issue.sku, row);
    }
    const entries = [...itemMap.entries()].sort((left, right) => right[1].count - left[1].count).slice(0, 8);
    const max = Math.max(1, ...entries.map(([, row]) => row.count));
    return entries.map(([label, row]) => ({ label, count: row.count, value: row.value, percent: Math.round(row.count / max * 100) }));
  }

  get returnRows(): CountRow[] {
    return this.rows(['Submitted', 'Received', 'Rejected'].map(status => [
      status,
      this.returns.filter(record => record.status === status).length
    ]));
  }

  get hasReportData(): boolean {
    return !!(this.tickets.length || this.requests.length || this.issues.length || this.returns.length || this.allInventory.length);
  }

  get openCount(): number {
    return this.tickets.filter(ticket => !this.isResolved(ticket.status)).length;
  }

  get resolvedCount(): number {
    return this.tickets.length - this.openCount;
  }

  get resolutionRate(): number {
    return this.tickets.length ? Math.round((this.resolvedCount / this.tickets.length) * 100) : 0;
  }

  get statusRows(): CountRow[] {
    return this.rows(this.statuses.map(status => [status, this.tickets.filter(ticket => ticket.status === status).length]));
  }

  get priorityRows(): CountRow[] {
    return this.rows(this.priorities.map(priority => [priority, this.tickets.filter(ticket => ticket.priority === priority).length]));
  }

  get categoryRows(): CountRow[] {
    const counts = new Map<string, number>();
    for (const ticket of this.tickets) counts.set(ticket.category || 'Uncategorized', (counts.get(ticket.category || 'Uncategorized') ?? 0) + 1);
    return this.rows([...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8));
  }

  get branchRows(): CountRow[] {
    const counts = new Map<string, number>();
    for (const ticket of this.tickets) {
      const label = `${ticket.customerName} · ${ticket.branchName}`;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return this.rows([...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8));
  }

  exportCsv(): void {
    if (!this.hasReportData) return;
    const rows: string[][] = [
      ['Type', 'Reference', 'Ticket', 'Customer', 'Item / subject', 'Status', 'Quantity', 'Value', 'Date'],
      ...this.tickets.map(ticket => ['Ticket', ticket.ticketNumber, ticket.ticketNumber, ticket.customerName, ticket.subject, ticket.status, '', '', ticket.createdAt]),
      ...this.requests.map(request => ['Spare request', request.requestNumber, request.ticketNumber, request.customerName, `${request.sku} · ${request.itemName}`, request.status, String(request.quantityRequested), '', request.createdAt]),
      ...this.issues.map(issue => ['Spare issue', issue.issueNumber, issue.ticketNumber, issue.customerName, `${issue.sku} · ${issue.itemName}`, 'Issued', String(issue.quantity), String(issue.quantity * issue.unitCost), issue.issuedAt]),
      ...this.returns.map(record => ['Defective return', record.returnNumber, record.ticketNumber, record.customerName, `${record.sku} · ${record.itemName}`, record.status, String(record.quantity), '', record.createdAt]),
      ...this.allInventory.map(item => ['Spare stock', item.sku, '', '', item.name, item.status, String(item.quantityOnHand), String(item.quantityOnHand * item.unitCost), item.updatedAt])
    ];
    const csv = rows.map(row => row.map(value => this.csvValue(value)).join(',')).join('\r\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.href = url;
    link.download = `service-operations-report-${this.selectedRange}days.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private rows(entries: [string, number, number?][]): CountRow[] {
    const max = Math.max(1, ...entries.map(([, count]) => count));
    return entries.map(([label, count, value]) => ({ label, count, value, percent: Math.round((count / max) * 100) }));
  }

  private isResolved(status: TicketStatus): boolean {
    return status === 'Resolved' || status === 'Closed';
  }

  private csvValue(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }
}
