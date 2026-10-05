import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { InventoryItem, InventoryService } from '../../core/services/inventory.service';
import { PurchaseOrder, PurchaseOrderPayload, PurchasingService, Vendor, VendorPayload } from '../../core/services/purchasing.service';
import { OperationsService, StockDocument } from '../../core/services/operations.service';

type PurchaseMode = 'vendors' | 'orders' | 'reports';
interface OrderLineDraft { inventoryItemId: string; quantityOrdered: number; unitCost: number; }
const blankVendor = (): VendorPayload => ({ vendorCode: '', name: '', contactName: '', email: '', phone: '', taxNumber: '', address: '', status: 'Active' });
const blankLine = (): OrderLineDraft => ({ inventoryItemId: '', quantityOrdered: 1, unitCost: 0 });

@Component({
  selector: 'app-purchase-module', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './purchase-module.html'
})
export class PurchaseModule implements OnInit {
  mode: PurchaseMode = 'orders';
  vendors: Vendor[] = [];
  orders: PurchaseOrder[] = [];
  inventory: InventoryItem[] = [];
  stockDocuments: StockDocument[] = [];
  vendorDraft = blankVendor();
  editingVendorId = '';
  orderDraft: PurchaseOrderPayload = { vendorId: '', expectedDate: '', notes: '', lines: [] };
  orderLines: OrderLineDraft[] = [blankLine()];
  loading = true;
  saving = false;
  busyId = '';
  error = '';
  notice = '';

  constructor(private route: ActivatedRoute, private api: PurchasingService, private inventoryApi: InventoryService, private operationsApi: OperationsService, private cdr: ChangeDetectorRef) {}
  ngOnInit(): void { this.route.data.subscribe(data => { this.mode = data['mode'] as PurchaseMode; this.load(); }); }
  load(): void {
    this.loading = true; this.error = '';
    forkJoin({ vendors: this.api.getVendors(), orders: this.api.getOrders(), inventory: this.inventoryApi.getItems(), stockDocuments: this.operationsApi.getStockDocuments() }).subscribe({
      next: data => { this.vendors = data.vendors.vendors ?? []; this.orders = data.orders.orders ?? []; this.inventory = data.inventory.items ?? []; this.stockDocuments = data.stockDocuments.documents ?? []; this.loading = false; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to load purchasing records.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }
  get pageTitle(): string { return this.mode === 'vendors' ? 'Vendors' : this.mode === 'reports' ? 'Purchase reports' : 'Purchase orders'; }
  get activeVendors(): Vendor[] { return this.vendors.filter(vendor => vendor.status === 'Active'); }
  get activeItems(): InventoryItem[] { return this.inventory.filter(item => item.status === 'Active'); }
  get openOrderCount(): number { return this.orders.filter(order => ['Placed', 'Partially Received'].includes(order.status)).length; }
  get orderedValue(): number { return this.orders.filter(order => order.status !== 'Cancelled').reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.quantityOrdered * line.unitCost, 0), 0); }
  get receivedValue(): number { return this.orders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.quantityReceived * line.unitCost, 0), 0); }
  addOrderLine(): void { this.orderLines = [...this.orderLines, blankLine()]; }
  removeOrderLine(index: number): void { this.orderLines = this.orderLines.filter((_line, i) => i !== index); }
  vendorSave(): void {
    if (this.saving) return;
    this.saving = true; this.error = ''; this.notice = '';
    const request = this.editingVendorId ? this.api.updateVendor(this.editingVendorId, this.vendorDraft) : this.api.createVendor(this.vendorDraft);
    request.subscribe({
      next: ({ vendor }) => { this.vendors = this.editingVendorId ? this.vendors.map(row => row._id === vendor._id ? vendor : row) : [...this.vendors, vendor].sort((a, b) => a.name.localeCompare(b.name)); this.notice = `${vendor.name} saved.`; this.cancelVendor(); this.saving = false; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to save vendor.'; this.saving = false; this.cdr.markForCheck(); }
    });
  }
  editVendor(vendor: Vendor): void { this.editingVendorId = vendor._id; this.vendorDraft = { vendorCode: vendor.vendorCode, name: vendor.name, contactName: vendor.contactName, email: vendor.email, phone: vendor.phone, taxNumber: vendor.taxNumber, address: vendor.address, status: vendor.status }; }
  cancelVendor(): void { this.editingVendorId = ''; this.vendorDraft = blankVendor(); }
  createOrder(): void {
    if (this.saving) return;
    this.saving = true; this.error = ''; this.notice = '';
    this.orderDraft.lines = this.orderLines.filter(line => !!line.inventoryItemId).map(line => ({ inventoryItemId: line.inventoryItemId, quantityOrdered: Number(line.quantityOrdered), unitCost: Number(line.unitCost) }));
    this.api.createOrder(this.orderDraft).subscribe({
      next: ({ order }) => { this.orders = [order, ...this.orders]; this.orderDraft = { vendorId: '', expectedDate: '', notes: '', lines: [] }; this.orderLines = [blankLine()]; this.notice = `${order.purchaseOrderNumber} saved as draft.`; this.saving = false; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to create purchase order.'; this.saving = false; this.cdr.markForCheck(); }
    });
  }
  changeOrderStatus(order: PurchaseOrder, status: 'Placed' | 'Cancelled'): void {
    this.busyId = order._id; this.error = '';
    this.api.updateOrderStatus(order._id, status).subscribe({
      next: ({ order: updated }) => { this.replaceOrder(updated); this.notice = `${updated.purchaseOrderNumber} marked ${updated.status.toLowerCase()}.`; this.busyId = ''; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to update purchase order.'; this.busyId = ''; this.cdr.markForCheck(); }
    });
  }
  receiveRemaining(order: PurchaseOrder): void {
    const lines = order.lines.map((line, lineIndex) => ({ lineIndex, quantity: line.quantityOrdered - line.quantityReceived })).filter(line => line.quantity > 0);
    if (!lines.length) return;
    this.busyId = order._id; this.error = '';
    this.api.receiveOrder(order._id, lines).subscribe({
      next: ({ order: updated }) => { this.replaceOrder(updated); this.notice = `Remaining stock for ${updated.purchaseOrderNumber} received into inventory.`; this.busyId = ''; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to receive purchase order.'; this.busyId = ''; this.cdr.markForCheck(); }
    });
  }
  outstanding(order: PurchaseOrder): number { return order.lines.reduce((sum, line) => sum + line.quantityOrdered - line.quantityReceived, 0); }
  orderTotal(order: PurchaseOrder): number { return order.lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitCost, 0); }
  receivedTotal(order: PurchaseOrder): number { return order.lines.reduce((sum, line) => sum + line.quantityReceived * line.unitCost, 0); }
  goodsReceipt(order: PurchaseOrder): StockDocument | undefined { return this.stockDocuments.find(document => document.purchaseOrderId === order._id); }
  lineTotal(): number { return this.orderLines.reduce((sum, line) => sum + Number(line.quantityOrdered || 0) * Number(line.unitCost || 0), 0); }
  exportCsv(): void {
    const rows = [['PO number', 'Vendor', 'Order date', 'Expected date', 'Status', 'Value', 'Received value'], ...this.orders.map(order => [order.purchaseOrderNumber, order.vendorName, order.orderDate, order.expectedDate ?? '', order.status, String(this.orderTotal(order)), String(order.lines.reduce((sum, line) => sum + line.quantityReceived * line.unitCost, 0))])];
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'purchase-report.csv'; link.click(); URL.revokeObjectURL(url);
  }
  private replaceOrder(order: PurchaseOrder): void { this.orders = this.orders.map(row => row._id === order._id ? order : row); }
}
