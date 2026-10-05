import { FinanceModule } from './finance-module';
import { SalesInvoice } from '../../core/services/operations.service';
import { SalesOrder } from '../../core/services/sales.service';

function invoice(overrides: Partial<SalesInvoice> = {}): SalesInvoice {
  return {
    _id: 'invoice-id',
    invoiceNumber: 'INV-0001',
    orderId: 'order-id',
    orderNumber: 'SO-0001',
    customerId: 'customer-id',
    customerName: 'Northstar Services',
    issueDate: '2026-10-01T00:00:00.000Z',
    dueDate: null,
    subTotal: 1000,
    discountAmount: 0,
    taxAmount: 180,
    roundOff: 0,
    total: 1180,
    status: 'Draft',
    notes: '',
    createdBy: 'admin',
    paidAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides
  };
}

function financeModule(): FinanceModule {
  return Object.create(FinanceModule.prototype) as FinanceModule;
}

describe('FinanceModule invoice register', () => {
  it('filters invoices by status and invoice/customer/order search', () => {
    const component = financeModule();
    component.invoices = [
      invoice(),
      invoice({ _id: 'invoice-2', invoiceNumber: 'INV-0002', orderNumber: 'SO-0002', status: 'Issued', customerName: 'Acme Schools' })
    ];
    component.invoiceStatusFilter = 'Issued';
    component.invoiceSearch = 'acme';

    expect(component.filteredInvoices.map(row => row.invoiceNumber)).toEqual(['INV-0002']);
  });

  it('marks only issued invoices with a past due date as overdue', () => {
    const component = financeModule();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDue = invoice({ status: 'Issued', dueDate: yesterday.toISOString() });

    expect(component.isOverdue(pastDue)).toBe(true);
    expect(component.isOverdue({ ...pastDue, status: 'Paid' })).toBe(false);
    expect(component.isOverdue({ ...pastDue, dueDate: null })).toBe(false);
  });

  it('tracks partial receipts and leaves the correct invoice balance', () => {
    const component = financeModule();
    const partiallyPaid = invoice({ status: 'Partially Paid', amountPaid: 400 });
    component.invoices = [partiallyPaid];

    expect(component.invoicePaidAmount(partiallyPaid)).toBe(400);
    expect(component.invoiceBalanceDue(partiallyPaid)).toBe(780);
    expect(component.billedRevenue).toBe(400);
    expect(component.outstandingInvoiceAmount).toBe(780);
  });

  it('copies the originating quote notes into the invoice description', () => {
    const component = financeModule();
    component.orders = [{ _id: 'order-id', notes: 'Installation and setup included' } as SalesOrder];

    component.selectInvoiceOrder('order-id');

    expect(component.invoiceDescription).toBe('Installation and setup included');
  });
});
