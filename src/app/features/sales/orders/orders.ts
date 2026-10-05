import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FulfillmentDocumentSummary, FulfillmentOption, SalesOrder, SalesOrderStatus, SalesService } from '../../../core/services/sales.service';

@Component({
  selector: 'app-sales-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './orders.html',
  styleUrl: './orders.css'
})
export class SalesOrders implements OnInit {
  orders: SalesOrder[] = [];
  loading = true;
  statusBusyId = '';
  searchText = '';
  statusFilter = '';
  sortBy: 'orderDate' | 'orderNumber' | 'customerName' | 'total' = 'orderDate';
  sortDirection: 'asc' | 'desc' = 'desc';
  page = 1;
  pageSize = 20;
  pageError = '';
  notice = '';
  selectedOrder: SalesOrder | null = null;
  selectedFulfillmentOrder: SalesOrder | null = null;
  fulfillmentItems: FulfillmentOption[] = [];
  fulfillmentDocuments: FulfillmentDocumentSummary[] = [];
  fulfillmentSelection: Record<string, boolean> = {};
  fulfillmentQuantities: Record<string, number> = {};
  fulfillmentLoading = false;
  fulfillmentBusy = false;
  fulfillmentError = '';
  private readonly requestedOrderId: string;
  customerFilterId: string;

  constructor(private sales: SalesService, private route: ActivatedRoute, private cdr: ChangeDetectorRef) {
    this.requestedOrderId = this.route.snapshot.queryParamMap.get('orderId') ?? '';
    this.customerFilterId = this.route.snapshot.queryParamMap.get('customerId') ?? '';
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.pageError = '';
    this.sales.getOrders().subscribe({
      next: response => {
        this.orders = response.orders ?? [];
        if (this.requestedOrderId) this.selectedOrder = this.orders.find(order => order._id === this.requestedOrderId) ?? null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.pageError = error?.error?.message ?? 'Unable to load sales orders.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get filteredOrders(): SalesOrder[] {
    const query = this.searchText.trim().toLowerCase();
    return this.orders.filter(order => {
      const matchesQuery = !query || [order.orderNumber, order.quoteNumber, order.customerName, order.customerEmail, order.customerPhone,
        ...order.lineItems.map(line => line.name)]
        .some(value => value.toLowerCase().includes(query));
      return matchesQuery && (!this.statusFilter || order.status === this.statusFilter) &&
        (!this.customerFilterId || order.customerId === this.customerFilterId);
    });
  }

  get sortedOrders(): SalesOrder[] {
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    return [...this.filteredOrders].sort((a, b) => {
      const left = this.sortBy === 'total' ? a.total
        : this.sortBy === 'orderDate' ? Date.parse(a.orderDate)
          : this.sortBy === 'orderNumber' ? a.orderNumber.toLowerCase() : a.customerName.toLowerCase();
      const right = this.sortBy === 'total' ? b.total
        : this.sortBy === 'orderDate' ? Date.parse(b.orderDate)
          : this.sortBy === 'orderNumber' ? b.orderNumber.toLowerCase() : b.customerName.toLowerCase();
      return (left < right ? -1 : left > right ? 1 : a.orderNumber.localeCompare(b.orderNumber)) * direction;
    });
  }

  get pageCount(): number { return Math.max(1, Math.ceil(this.sortedOrders.length / this.pageSize)); }
  get currentPage(): number { return Math.min(this.page, this.pageCount); }
  get pageOrders(): SalesOrder[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedOrders.slice(start, start + this.pageSize);
  }

  changePage(page: number): void { this.page = Math.min(this.pageCount, Math.max(1, page)); }

  exportCsv(): void {
    const columns = ['Order', 'Quote', 'Customer', 'Email', 'Phone', 'Status', 'Order date', 'Lines', 'Subtotal', 'Discount rate', 'Discount amount', 'Tax rate', 'Tax amount', 'Round off', 'Total'];
    const rows = this.sortedOrders.map(order => [order.orderNumber, order.quoteNumber, order.customerName, order.customerEmail,
      order.customerPhone, order.status, order.orderDate.slice(0, 10), order.lineItems.length, order.subTotal,
      order.discountRate ?? 0, order.discountAmount ?? 0, order.taxRate, order.taxAmount, order.roundOff ?? 0, order.total]);
    const csv = [columns, ...rows].map(row => row.map(value => {
      let cell = String(value ?? '');
      if (/^[=+\-@]/.test(cell.trimStart())) cell = `'${cell}`;
      return `"${cell.replaceAll('"', '""')}"`;
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  get activeOrders(): SalesOrder[] {
    return this.orders.filter(order => order.status !== 'Cancelled');
  }

  get processingCount(): number {
    return this.orders.filter(order => order.status === 'Processing').length;
  }

  get confirmedCount(): number {
    return this.orders.filter(order => order.status === 'Confirmed').length;
  }

  get bookedValue(): number {
    return this.activeOrders.reduce((total, order) => total + order.total, 0);
  }

  get fulfilledValue(): number {
    return this.orders.filter(order => order.status === 'Fulfilled')
      .reduce((total, order) => total + order.total, 0);
  }

  get partiallyFulfilledCount(): number {
    return this.orders.filter(order => order.status === 'Partially Fulfilled').length;
  }

  nextStatuses(order: SalesOrder): SalesOrderStatus[] {
    if (order.status === 'Confirmed') return ['Processing', 'Cancelled'];
    if (order.status === 'Processing') return ['Cancelled'];
    return [];
  }

  updateStatus(order: SalesOrder, status: SalesOrderStatus): void {
    if (this.statusBusyId || !this.nextStatuses(order).includes(status)) return;
    this.statusBusyId = order._id;
    this.pageError = '';
    this.sales.updateOrderStatus(order._id, status).subscribe({
      next: response => {
        const updated = response.order;
        this.orders = this.orders.map(existing => existing._id === updated._id ? updated : existing);
        if (this.selectedOrder?._id === updated._id) this.selectedOrder = updated;
        this.statusBusyId = '';
        this.notice = `${updated.orderNumber} moved to ${updated.status.toLowerCase()}.`;
        this.cdr.markForCheck();
      },
      error: error => {
        this.pageError = error?.error?.message ?? 'Unable to update sales order status.';
        this.statusBusyId = '';
        this.cdr.markForCheck();
      }
    });
  }

  openFulfillment(order: SalesOrder): void {
    if (this.statusBusyId || this.fulfillmentBusy || !['Processing', 'Partially Fulfilled'].includes(order.status)) return;
    this.selectedFulfillmentOrder = order;
    this.fulfillmentItems = [];
    this.fulfillmentDocuments = [];
    this.fulfillmentSelection = {};
    this.fulfillmentQuantities = {};
    this.fulfillmentError = '';
    this.fulfillmentLoading = true;
    this.sales.getFulfillmentOptions(order._id).subscribe({
      next: response => {
        this.fulfillmentItems = response.items ?? [];
        this.fulfillmentDocuments = response.documents ?? [];
        this.fulfillmentQuantities = Object.fromEntries(this.fulfillmentItems.map(item => [item.inventoryItemId, this.maxFulfillmentQuantity(item)]));
        this.fulfillmentLoading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.fulfillmentError = error?.error?.message ?? 'Unable to load available stock for this order.';
        this.fulfillmentLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  closeFulfillment(): void {
    if (this.fulfillmentBusy) return;
    this.selectedFulfillmentOrder = null;
    this.fulfillmentError = '';
  }

  maxFulfillmentQuantity(item: FulfillmentOption): number {
    return Math.max(0, Math.min(item.remainingQuantity, item.availableQuantity));
  }

  setFulfillmentSelection(item: FulfillmentOption, selected: boolean): void {
    this.fulfillmentSelection = { ...this.fulfillmentSelection, [item.inventoryItemId]: selected && this.maxFulfillmentQuantity(item) > 0 };
    if (selected && !this.fulfillmentQuantities[item.inventoryItemId]) {
      this.fulfillmentQuantities = { ...this.fulfillmentQuantities, [item.inventoryItemId]: this.maxFulfillmentQuantity(item) };
    }
  }

  setFulfillmentQuantity(item: FulfillmentOption, value: number | string): void {
    const quantity = Number(value);
    this.fulfillmentQuantities = {
      ...this.fulfillmentQuantities,
      [item.inventoryItemId]: Number.isFinite(quantity) ? quantity : 0
    };
  }

  get selectedFulfillmentLines(): { inventoryItemId: string; quantity: number }[] {
    return this.fulfillmentItems.filter(item => this.fulfillmentSelection[item.inventoryItemId])
      .map(item => ({ inventoryItemId: item.inventoryItemId, quantity: Number(this.fulfillmentQuantities[item.inventoryItemId]) }));
  }

  get selectedFulfillmentUnits(): number {
    return this.selectedFulfillmentLines.reduce((sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0), 0);
  }

  get validFulfillmentSelection(): boolean {
    if (!this.fulfillmentItems.length) return true;
    const lines = this.selectedFulfillmentLines;
    return lines.length > 0 && lines.every(line => {
      const item = this.fulfillmentItems.find(candidate => candidate.inventoryItemId === line.inventoryItemId);
      return !!item && Number.isFinite(line.quantity) && line.quantity > 0 && line.quantity <= this.maxFulfillmentQuantity(item);
    });
  }

  submitFulfillment(): void {
    const order = this.selectedFulfillmentOrder;
    if (!order || this.fulfillmentBusy || this.fulfillmentLoading) return;
    const lines = this.selectedFulfillmentLines;
    if (this.fulfillmentItems.length && !lines.length) {
      this.fulfillmentError = 'Select at least one available item to issue on this challan.';
      return;
    }
    for (const line of lines) {
      const item = this.fulfillmentItems.find(candidate => candidate.inventoryItemId === line.inventoryItemId);
      if (!item || !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > this.maxFulfillmentQuantity(item)) {
        this.fulfillmentError = 'Each selected quantity must be greater than zero and within the available amount.';
        return;
      }
    }

    this.fulfillmentBusy = true;
    this.fulfillmentError = '';
    this.sales.fulfillOrder(order._id, lines).subscribe({
      next: response => {
        const updated = response.order;
        this.orders = this.orders.map(existing => existing._id === updated._id ? updated : existing);
        if (this.selectedOrder?._id === updated._id) this.selectedOrder = updated;
        const challanNumber = response.stockDocument?.documentNumber;
        this.notice = challanNumber
          ? `${challanNumber} created for ${updated.orderNumber}. ${updated.status === 'Fulfilled' ? 'All inventory quantities are dispatched.' : 'The remaining order quantities stay open for a later dispatch.'}`
          : `${updated.orderNumber} completed. No inventory-tracked items needed a challan.`;
        this.fulfillmentBusy = false;
        this.selectedFulfillmentOrder = null;
        this.cdr.markForCheck();
      },
      error: error => {
        this.fulfillmentError = error?.error?.message ?? 'Unable to create the delivery challan.';
        this.fulfillmentBusy = false;
        this.cdr.markForCheck();
      }
    });
  }

  statusTone(status: SalesOrderStatus): string {
    return `order-${status.toLowerCase().replaceAll(' ', '-')}`;
  }

  openOrder(order: SalesOrder): void {
    this.selectedOrder = order;
  }

  closeOrder(): void {
    this.selectedOrder = null;
  }

  clearCustomerFilter(): void { this.customerFilterId = ''; this.page = 1; }
}
