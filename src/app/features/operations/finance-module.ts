import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ExpensePayload, ExpenseStatus, ExpenseVoucher, InvoiceStatus, OperationsService, SalesInvoice } from '../../core/services/operations.service';
import { QuoteProfile, SalesOrder, SalesService } from '../../core/services/sales.service';

type FinanceMode = 'finance' | 'invoices' | 'expenses' | 'reports';
const today = (): string => { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 10); };
const blankExpense = (): ExpensePayload => ({ voucherDate: today(), category: '', payee: '', amount: 0, paymentMethod: 'Bank transfer', reference: '', description: '' });
const blankQuoteProfile: QuoteProfile = {
  companyName: '', companyAddress: '', companyState: '', companyPhone: '', companyEmail: '', companyWebsite: '',
  companyPan: '', companyGstin: '', companyMsme: '', bankName: '', bankAccountNumber: '', bankBranch: '', bankIfsc: '',
  contactName: '', contactPhone: '', contactMobile: '', contactEmail: '', authorizedSignatory: '', defaultValidityDays: 30, defaultTerms: ''
};

@Component({
  selector: 'app-finance-module', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './finance-module.html',
  styleUrl: './finance-module.css'
})
export class FinanceModule implements OnInit {
  mode: FinanceMode = 'finance';
  invoices: SalesInvoice[] = [];
  expenses: ExpenseVoucher[] = [];
  orders: SalesOrder[] = [];
  companyProfile: QuoteProfile = { ...blankQuoteProfile };
  draftExpense = blankExpense();
  selectedOrderId = '';
  invoiceDueDate = '';
  invoiceDescription = '';
  invoiceSearch = '';
  invoiceStatusFilter: InvoiceStatus | '' = '';
  invoiceFormOpen = false;
  selectedInvoice: SalesInvoice | null = null;
  printInvoice: SalesInvoice | null = null;
  paymentInvoice: SalesInvoice | null = null;
  paymentAmount = 0;
  paymentDate = today();
  paymentMethod = 'Bank transfer';
  paymentReference = '';
  paymentNotes = '';
  saving = false;
  loading = true;
  busyId = '';
  error = '';
  notice = '';

  constructor(private route: ActivatedRoute, private api: OperationsService, private sales: SalesService, private cdr: ChangeDetectorRef) {}
  ngOnInit(): void { this.route.data.subscribe(data => { this.mode = data['mode'] as FinanceMode; this.load(); }); }
  load(): void {
    this.loading = true; this.error = '';
    forkJoin({ invoices: this.api.getInvoices(), expenses: this.api.getExpenses(), orders: this.sales.getOrders() }).subscribe({
      next: data => { this.invoices = data.invoices.invoices ?? []; this.expenses = data.expenses.vouchers ?? []; this.orders = data.orders.orders ?? []; this.loading = false; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to load finance registers.'; this.loading = false; this.cdr.markForCheck(); }
    });
    if (this.mode === 'invoices') {
      this.sales.getQuoteProfile().subscribe({
        next: ({ profile }) => { this.companyProfile = { ...blankQuoteProfile, ...profile }; this.cdr.markForCheck(); },
        error: () => { this.companyProfile = { ...blankQuoteProfile }; this.cdr.markForCheck(); }
      });
    }
  }
  get pageTitle(): string { return this.mode === 'invoices' ? 'Sales invoices' : this.mode === 'expenses' ? 'Expense vouchers' : this.mode === 'reports' ? 'Finance reports' : 'Finance'; }
  get unbilledOrders(): SalesOrder[] {
    const invoiced = new Set(this.invoices.map(invoice => invoice.orderId));
    return this.orders.filter(order => order.status !== 'Cancelled' && !invoiced.has(order._id));
  }
  get filteredInvoices(): SalesInvoice[] {
    const query = this.invoiceSearch.trim().toLowerCase();
    return this.invoices.filter(invoice => {
      const matchesStatus = !this.invoiceStatusFilter || invoice.status === this.invoiceStatusFilter;
      const matchesQuery = !query || [invoice.invoiceNumber, invoice.customerName, invoice.orderNumber]
        .some(value => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }
  get overdueInvoiceCount(): number { return this.invoices.filter(invoice => this.isOverdue(invoice)).length; }
  get outstandingInvoiceAmount(): number { return this.invoices.reduce((sum, invoice) => sum + this.invoiceBalanceDue(invoice), 0); }
  get draftInvoiceAmount(): number { return this.invoices.filter(invoice => invoice.status === 'Draft').reduce((sum, invoice) => sum + invoice.total, 0); }
  get selectedOrder(): SalesOrder | undefined { return this.orders.find(order => order._id === this.selectedOrderId); }
  selectInvoiceOrder(orderId: string): void {
    this.selectedOrderId = orderId;
    this.invoiceDescription = this.orders.find(order => order._id === orderId)?.notes ?? '';
  }
  get receivables(): number { return this.outstandingInvoiceAmount; }
  get billedRevenue(): number { return this.invoices.filter(invoice => invoice.status !== 'Voided').reduce((sum, invoice) => sum + this.invoicePaidAmount(invoice), 0); }
  get paidExpenses(): number { return this.expenses.filter(voucher => voucher.status === 'Paid').reduce((sum, voucher) => sum + voucher.amount, 0); }
  get draftExpenses(): number { return this.expenses.filter(voucher => voucher.status === 'Draft' || voucher.status === 'Approved').reduce((sum, voucher) => sum + voucher.amount, 0); }
  createInvoice(): void {
    if (!this.selectedOrderId || this.saving) return;
    this.saving = true; this.error = ''; this.notice = '';
    this.api.createInvoice(this.selectedOrderId, this.invoiceDueDate, this.invoiceDescription.trim()).subscribe({
      next: ({ invoice }) => { this.invoices = [invoice, ...this.invoices]; this.selectedOrderId = ''; this.invoiceDueDate = ''; this.invoiceDescription = ''; this.invoiceFormOpen = false; this.notice = `${invoice.invoiceNumber} created as a draft.`; this.saving = false; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to create invoice.'; this.saving = false; this.cdr.markForCheck(); }
    });
  }
  isOverdue(invoice: SalesInvoice): boolean {
    if ((invoice.status !== 'Issued' && invoice.status !== 'Partially Paid') || !invoice.dueDate || this.invoiceBalanceDue(invoice) <= 0) return false;
    const due = new Date(invoice.dueDate);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const now = new Date();
    const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return dueDay < todayDay;
  }
  invoiceStatusClass(status: InvoiceStatus): string {
    return status === 'Paid' ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-200'
      : status === 'Issued' ? 'border-sky-300/20 bg-sky-300/[0.06] text-sky-200'
      : status === 'Partially Paid' ? 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200'
      : status === 'Voided' ? 'border-rose-300/20 bg-rose-300/[0.06] text-rose-200'
      : 'border-amber-300/20 bg-amber-300/[0.06] text-amber-200';
  }
  invoicePaidAmount(invoice: SalesInvoice): number {
    return invoice.status === 'Paid' ? invoice.total : Math.min(invoice.total, Math.max(0, invoice.amountPaid ?? 0));
  }
  invoiceBalanceDue(invoice: SalesInvoice): number {
    if (invoice.status === 'Voided') return 0;
    return Math.max(0, Math.round((invoice.total - this.invoicePaidAmount(invoice)) * 100) / 100);
  }
  invoiceOrder(invoice: SalesInvoice): SalesOrder | undefined {
    return this.orders.find(order => order._id === invoice.orderId);
  }
  invoiceSeller(invoice: SalesInvoice): QuoteProfile {
    const snapshot = this.invoiceOrder(invoice)?.sellerSnapshot;
    const current = this.companyProfile;
    return {
      ...blankQuoteProfile,
      ...current,
      ...(snapshot ?? {}),
      companyName: snapshot?.companyName || current.companyName,
      companyAddress: snapshot?.companyAddress || current.companyAddress,
      companyState: snapshot?.companyState || current.companyState,
      companyPhone: snapshot?.companyPhone || current.companyPhone,
      companyEmail: snapshot?.companyEmail || current.companyEmail,
      companyWebsite: snapshot?.companyWebsite || current.companyWebsite,
      companyPan: snapshot?.companyPan || current.companyPan,
      companyGstin: snapshot?.companyGstin || current.companyGstin,
      companyMsme: snapshot?.companyMsme || current.companyMsme,
      bankName: snapshot?.bankName || current.bankName,
      bankAccountNumber: snapshot?.bankAccountNumber || current.bankAccountNumber,
      bankBranch: snapshot?.bankBranch || current.bankBranch,
      bankIfsc: snapshot?.bankIfsc || current.bankIfsc,
      authorizedSignatory: snapshot?.authorizedSignatory || current.authorizedSignatory
    };
  }
  isInterStateInvoice(invoice: SalesInvoice): boolean {
    const sellerState = this.invoiceSeller(invoice).companyState.trim().toLowerCase();
    const customerState = (this.invoiceOrder(invoice)?.customerState ?? '').trim().toLowerCase();
    return !!sellerState && !!customerState && sellerState !== customerState;
  }
  openInvoice(invoice: SalesInvoice): void { this.selectedInvoice = invoice; }
  closeInvoice(): void { this.selectedInvoice = null; }
  openPayment(invoice: SalesInvoice): void {
    if (invoice.status !== 'Issued' && invoice.status !== 'Partially Paid') return;
    this.paymentInvoice = invoice;
    this.paymentAmount = this.invoiceBalanceDue(invoice);
    this.paymentDate = today();
    this.paymentMethod = 'Bank transfer';
    this.paymentReference = '';
    this.paymentNotes = '';
  }
  closePayment(): void { this.paymentInvoice = null; }
  recordPayment(): void {
    const invoice = this.paymentInvoice;
    if (!invoice || this.saving || this.paymentAmount <= 0) return;
    this.saving = true; this.error = ''; this.notice = '';
    this.api.recordInvoicePayment(invoice._id, {
      amount: Number(this.paymentAmount), paymentDate: this.paymentDate,
      method: this.paymentMethod, reference: this.paymentReference.trim(), notes: this.paymentNotes.trim()
    }).subscribe({
      next: ({ invoice: updated }) => {
        this.invoices = this.invoices.map(row => row._id === updated._id ? updated : row);
        if (this.selectedInvoice?._id === updated._id) this.selectedInvoice = updated;
        this.paymentInvoice = null;
        this.notice = `${updated.invoiceNumber} payment recorded. Balance due: ${this.invoiceBalanceDue(updated).toFixed(2)}.`;
        this.saving = false; this.cdr.markForCheck();
      },
      error: error => { this.error = error?.error?.message ?? 'Unable to record invoice payment.'; this.saving = false; this.cdr.markForCheck(); }
    });
  }
  printInvoiceDocument(invoice: SalesInvoice): void {
    this.printInvoice = invoice;
    document.body.classList.add('printing-invoice');
    this.cdr.detectChanges();
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-invoice');
      this.printInvoice = null;
      this.cdr.markForCheck();
    }, { once: true });
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }
  createExpense(): void {
    if (this.saving) return;
    this.saving = true; this.error = ''; this.notice = '';
    this.api.createExpense(this.draftExpense).subscribe({
      next: ({ voucher }) => { this.expenses = [voucher, ...this.expenses]; this.notice = `${voucher.voucherNumber} recorded as draft.`; this.draftExpense = blankExpense(); this.saving = false; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to create expense voucher.'; this.saving = false; this.cdr.markForCheck(); }
    });
  }
  updateInvoice(invoice: SalesInvoice, status: InvoiceStatus): void {
    this.busyId = invoice._id; this.error = '';
    this.api.updateInvoice(invoice._id, status).subscribe({
      next: ({ invoice: updated }) => { this.invoices = this.invoices.map(row => row._id === updated._id ? updated : row); this.notice = `${updated.invoiceNumber} marked ${updated.status.toLowerCase()}.`; this.busyId = ''; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to update invoice.'; this.busyId = ''; this.cdr.markForCheck(); }
    });
  }
  updateExpense(voucher: ExpenseVoucher, status: ExpenseStatus): void {
    this.busyId = voucher._id; this.error = '';
    this.api.updateExpense(voucher._id, status).subscribe({
      next: ({ voucher: updated }) => { this.expenses = this.expenses.map(row => row._id === updated._id ? updated : row); this.notice = `${updated.voucherNumber} marked ${updated.status.toLowerCase()}.`; this.busyId = ''; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to update voucher.'; this.busyId = ''; this.cdr.markForCheck(); }
    });
  }
  invoiceActions(status: string): InvoiceStatus[] { return status === 'Draft' ? ['Issued', 'Voided'] : status === 'Issued' ? ['Voided'] : []; }
  expenseActions(status: string): ExpenseStatus[] { return status === 'Draft' ? ['Approved', 'Rejected'] : status === 'Approved' ? ['Paid', 'Rejected'] : []; }
  exportCsv(): void {
    const rows = [['Type', 'Number', 'Date', 'Party', 'Reference', 'Status', 'Amount'],
      ...this.invoices.map(item => ['Invoice', item.invoiceNumber, item.issueDate, item.customerName, item.orderNumber, item.status, String(item.total)]),
      ...this.expenses.map(item => ['Expense', item.voucherNumber, item.voucherDate, item.payee, item.reference, item.status, String(item.amount)])];
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'finance-register.csv'; link.click(); URL.revokeObjectURL(url);
  }
}
