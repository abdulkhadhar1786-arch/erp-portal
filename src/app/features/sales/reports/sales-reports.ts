import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CustomerService, CustomerSummary } from '../../../core/services/customer.service';
import { CrmLead, CrmService, LEAD_STAGES, LeadStage } from '../../../core/services/crm.service';
import { QuoteStatus, SALES_ORDER_STATUSES, SalesOrder, SalesQuote, SalesService } from '../../../core/services/sales.service';

interface ReportRow {
  label: string;
  count: number;
  percent: number;
  value?: number;
}

@Component({
  selector: 'app-sales-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sales-reports.html'
})
export class SalesReports implements OnInit {
  readonly ranges = [
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
    { label: 'Last 12 months', value: '365' },
    { label: 'All time', value: 'all' }
  ];
  readonly leadStages = LEAD_STAGES;
  readonly quoteStatuses: QuoteStatus[] = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];
  readonly orderStatuses = SALES_ORDER_STATUSES;
  selectedRange = '90';
  leads: CrmLead[] = [];
  quotes: SalesQuote[] = [];
  orders: SalesOrder[] = [];
  customers: CustomerSummary[] = [];
  loading = true;
  errorMessage = '';
  lastUpdated = '';

  constructor(
    private crm: CrmService,
    private sales: SalesService,
    private customerApi: CustomerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      leads: this.crm.getLeads(),
      quotes: this.sales.getQuotes(),
      orders: this.sales.getOrders(),
      customers: this.customerApi.getCustomers()
    }).subscribe({
      next: ({ leads, quotes, orders, customers }) => {
        this.leads = leads.leads ?? [];
        this.quotes = quotes.quotes ?? [];
        this.orders = orders.orders ?? [];
        this.customers = customers.customers ?? [];
        this.lastUpdated = new Date().toISOString();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load CRM and sales report data.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get periodLeads(): CrmLead[] { return this.inPeriod(this.leads); }
  get periodQuotes(): SalesQuote[] { return this.inPeriod(this.quotes); }
  get periodOrders(): SalesOrder[] {
    if (this.selectedRange === 'all') return this.orders;
    const cutoff = Date.now() - Number(this.selectedRange) * 24 * 60 * 60 * 1000;
    return this.orders.filter(order => Date.parse(order.orderDate || order.createdAt) >= cutoff);
  }

  get activeLeads(): CrmLead[] {
    return this.periodLeads.filter(lead => lead.stage !== 'Won' && lead.stage !== 'Lost');
  }

  get pipelineValue(): number {
    return this.activeLeads.reduce((total, lead) => total + lead.expectedValue, 0);
  }

  get weightedPipelineValue(): number {
    return this.activeLeads.reduce((total, lead) => total + lead.expectedValue * (lead.probability ?? 10) / 100, 0);
  }

  get winRate(): number {
    const closed = this.periodLeads.filter(lead => lead.stage === 'Won' || lead.stage === 'Lost');
    return closed.length ? Math.round(closed.filter(lead => lead.stage === 'Won').length / closed.length * 100) : 0;
  }

  get awaitingQuotes(): SalesQuote[] {
    return this.periodQuotes.filter(quote => quote.status === 'Sent');
  }

  get acceptedQuoteValue(): number {
    return this.periodQuotes.filter(quote => quote.status === 'Accepted')
      .reduce((total, quote) => total + quote.total, 0);
  }

  get activeOrders(): SalesOrder[] {
    return this.periodOrders.filter(order => order.status === 'Confirmed' || order.status === 'Processing');
  }

  get activeOrderValue(): number {
    return this.activeOrders.reduce((total, order) => total + order.total, 0);
  }

  get activeCustomers(): number {
    return this.customers.filter(customer => customer.status === 'Active').length;
  }

  get leadRows(): ReportRow[] {
    return this.rows(this.leadStages.map(stage => [
      stage,
      this.periodLeads.filter(lead => lead.stage === stage).length,
      this.periodLeads.filter(lead => lead.stage === stage).reduce((sum, lead) => sum + lead.expectedValue, 0)
    ]));
  }

  get quoteRows(): ReportRow[] {
    return this.rows(this.quoteStatuses.map(status => [
      status,
      this.periodQuotes.filter(quote => quote.status === status).length,
      this.periodQuotes.filter(quote => quote.status === status).reduce((sum, quote) => sum + quote.total, 0)
    ]));
  }

  get orderRows(): ReportRow[] {
    return this.rows(this.orderStatuses.map(status => [
      status,
      this.periodOrders.filter(order => order.status === status).length,
      this.periodOrders.filter(order => order.status === status).reduce((sum, order) => sum + order.total, 0)
    ]));
  }

  get customerStatusRows(): ReportRow[] {
      return this.rows(['Active', 'On Hold', 'Blacklisted', 'Inactive'].map(status => [
      status,
      this.customers.filter(customer => customer.status === status).length
    ]));
  }

  get industryRows(): ReportRow[] {
    const counts = new Map<string, number>();
    for (const customer of this.customers) {
      const industry = customer.industry?.trim() || 'Unspecified';
      counts.set(industry, (counts.get(industry) ?? 0) + 1);
    }
    return this.rows([...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([label, count]) => [label, count]));
  }

  exportCsv(): void {
    const records: string[][] = [
      ['Type', 'Record', 'Account', 'Status', 'Value', 'Date'],
      ...this.periodLeads.map(lead => ['Lead', lead.leadNumber, lead.companyName, lead.stage, String(lead.expectedValue), lead.createdAt]),
      ...this.periodQuotes.map(quote => ['Quotation', quote.quoteNumber, quote.customerName, quote.status, String(quote.total), quote.createdAt]),
      ...this.periodOrders.map(order => ['Sales order', order.orderNumber, order.customerName, order.status, String(order.total), order.orderDate || order.createdAt]),
      ...this.customers.map(customer => ['Customer', customer.code, customer.name, customer.status, '', ''])
    ];
    const csv = records.map(row => row.map(value => this.csvValue(value)).join(',')).join('\r\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.href = url;
    link.download = `crm-sales-report-${this.selectedRange}days.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private inPeriod<T extends { createdAt: string }>(records: T[]): T[] {
    if (this.selectedRange === 'all') return records;
    const cutoff = Date.now() - Number(this.selectedRange) * 24 * 60 * 60 * 1000;
    return records.filter(record => Date.parse(record.createdAt) >= cutoff);
  }

  private rows(entries: [string, number, number?][]): ReportRow[] {
    const max = Math.max(1, ...entries.map(([, count]) => count));
    return entries.map(([label, count, value]) => ({
      label,
      count,
      percent: Math.round((count / max) * 100),
      value
    }));
  }

  private csvValue(value: string): string {
    const safeValue = /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
    return `"${safeValue.replaceAll('"', '""')}"`;
  }
}
