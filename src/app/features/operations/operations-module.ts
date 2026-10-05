import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { InventoryItem, InventoryService } from '../../core/services/inventory.service';
import { DeliveryRecord, DeliveryStatus, OperationsService, StockDocument, StockDocumentPayload } from '../../core/services/operations.service';
import { QuoteProfile, SalesOrder, SalesService } from '../../core/services/sales.service';

type OperationsMode = 'delivery-challans' | 'adjustment' | 'inventory-reports';
interface StockLineDraft { inventoryItemId: string; quantity: number; direction: 'In' | 'Out'; }

function blankLine(): StockLineDraft { return { inventoryItemId: '', quantity: 1, direction: 'In' }; }

@Component({
  selector: 'app-operations-module',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './operations-module.html',
  styleUrl: './operations-module.css'
})
export class OperationsModule implements OnInit {
  mode: OperationsMode = 'delivery-challans';
  documents: StockDocument[] = [];
  deliveries: DeliveryRecord[] = [];
  inventory: InventoryItem[] = [];
  orders: SalesOrder[] = [];
  companyProfile: QuoteProfile | null = null;
  loading = true;
  saving = false;
  busyId = '';
  errorMessage = '';
  notice = '';
  partyName = '';
  reference = '';
  notes = '';
  lines: StockLineDraft[] = [blankLine()];
  selectedDelivery: DeliveryRecord | null = null;
  printDelivery: DeliveryRecord | null = null;
  deliveryDraft = { recipient: '', carrier: '', trackingNumber: '' };
  deliverySearch = '';
  deliveryFilter: DeliveryStatus | 'All' | 'Exceptions' = 'All';
  deliverySort: 'recent' | 'oldest' | 'customer' = 'recent';
  deliveryPage = 1;
  readonly deliveryPageSize = 12;

  constructor(
    private route: ActivatedRoute,
    private ops: OperationsService,
    private inventoryApi: InventoryService,
    private sales: SalesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      this.mode = data['mode'] as OperationsMode;
      this.resetForm();
      this.load();
    });
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    if (this.mode === 'delivery-challans') {
      this.sales.getOrders().subscribe({
        next: response => { this.orders = response.orders ?? []; this.cdr.markForCheck(); },
        error: () => { this.orders = []; this.cdr.markForCheck(); }
      });
      this.sales.getQuoteProfile().subscribe({
        next: ({ profile }) => { this.companyProfile = profile; this.cdr.markForCheck(); },
        error: () => { this.companyProfile = null; this.cdr.markForCheck(); }
      });
    }
    forkJoin({
      documents: this.ops.getStockDocuments(),
      deliveries: this.ops.getDeliveries(),
      inventory: this.inventoryApi.getItems()
    }).subscribe({
      next: ({ documents, deliveries, inventory }) => {
        this.documents = documents.documents ?? [];
        this.deliveries = deliveries.deliveries ?? [];
        this.inventory = inventory.items ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load operations data.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get pageTitle(): string {
    const titles: Record<OperationsMode, string> = {
      'delivery-challans': 'Delivery management',
      adjustment: 'Inventory adjustment', 'inventory-reports': 'Inventory reports'
    };
    return titles[this.mode];
  }

  get documentType(): StockDocumentPayload['type'] { return 'Inventory Adjustment'; }

  get activeItems(): InventoryItem[] { return this.inventory.filter(item => item.status === 'Active'); }
  get documentList(): StockDocument[] { return this.documents.filter(document => document.type === this.documentType); }
  get lowStockItems(): InventoryItem[] {
    return this.activeItems.filter(item => item.quantityOnHand <= item.reorderLevel)
      .sort((a, b) => a.quantityOnHand - a.reorderLevel - (b.quantityOnHand - b.reorderLevel));
  }
  get inventoryValue(): number {
    return this.activeItems.reduce((sum, item) => sum + item.quantityOnHand * item.unitCost, 0);
  }
  get stockInValue(): number { return this.documentValue('In'); }
  get stockOutValue(): number { return this.documentValue('Out'); }
  get adjustmentCount(): number { return this.documents.filter(document => document.type === 'Inventory Adjustment').length; }
  get pendingDeliveries(): number { return this.deliveries.filter(delivery => delivery.status === 'Prepared' || delivery.status === 'In Transit').length; }
  get preparedDeliveries(): number { return this.deliveries.filter(delivery => delivery.status === 'Prepared').length; }
  get inTransitDeliveries(): number { return this.deliveries.filter(delivery => delivery.status === 'In Transit').length; }
  get deliveredDeliveries(): number { return this.deliveries.filter(delivery => delivery.status === 'Delivered').length; }
  get exceptionDeliveries(): number { return this.deliveries.filter(delivery => delivery.status === 'Failed' || delivery.status === 'Returned').length; }
  get filteredDeliveries(): DeliveryRecord[] {
    const query = this.deliverySearch.trim().toLowerCase();
    return this.deliveries.filter(delivery => {
      if (this.deliveryFilter === 'Exceptions' && delivery.status !== 'Failed' && delivery.status !== 'Returned') return false;
      if (this.deliveryFilter !== 'All' && this.deliveryFilter !== 'Exceptions' && delivery.status !== this.deliveryFilter) return false;
      if (!query) return true;
      const orderNumber = this.salesOrderNumberFor(delivery);
      return [delivery.challanNumber, delivery.deliveryNumber, orderNumber, delivery.customerName,
        delivery.recipient, delivery.carrier, delivery.trackingNumber]
        .some(value => value?.toLowerCase().includes(query));
    }).sort((a, b) => {
      if (this.deliverySort === 'customer') return a.customerName.localeCompare(b.customerName);
      const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return this.deliverySort === 'recent' ? -delta : delta;
    });
  }
  get deliveryPageCount(): number { return Math.max(1, Math.ceil(this.filteredDeliveries.length / this.deliveryPageSize)); }
  get visibleDeliveries(): DeliveryRecord[] {
    const start = (this.deliveryPage - 1) * this.deliveryPageSize;
    return this.filteredDeliveries.slice(start, start + this.deliveryPageSize);
  }
  itemFor(id: string): InventoryItem | undefined { return this.inventory.find(item => item._id === id); }
  stockDocumentFor(delivery: DeliveryRecord): StockDocument | undefined {
    return this.documents.find(document => document._id === delivery.stockDocumentId);
  }
  salesOrderIdFor(delivery: DeliveryRecord): string {
    return delivery.salesOrderId || this.stockDocumentFor(delivery)?.salesOrderId || '';
  }
  salesOrderNumberFor(delivery: DeliveryRecord): string {
    return delivery.salesOrderNumber || this.stockDocumentFor(delivery)?.salesOrderNumber || '';
  }
  deliveryOrderFor(delivery: DeliveryRecord): SalesOrder | undefined {
    const orderId = this.salesOrderIdFor(delivery);
    return this.orders.find(order => order._id === orderId);
  }
  deliverySellerFor(delivery: DeliveryRecord): QuoteProfile | null {
    return this.deliveryOrderFor(delivery)?.sellerSnapshot ?? this.companyProfile;
  }
  printDeliveryDocument(delivery: DeliveryRecord): void {
    this.printDelivery = delivery;
    document.body.classList.add('printing-delivery-challan');
    this.cdr.detectChanges();
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-delivery-challan');
      this.printDelivery = null;
      this.cdr.markForCheck();
    }, { once: true });
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }
  editDelivery(delivery: DeliveryRecord): void {
    this.selectedDelivery = delivery;
    this.errorMessage = '';
    this.notice = '';
    this.deliveryDraft = { recipient: delivery.recipient, carrier: delivery.carrier, trackingNumber: delivery.trackingNumber };
  }
  filterDeliveries(status: DeliveryStatus | 'All'): void { this.deliveryFilter = status; this.deliveryPage = 1; }
  filterExceptions(): void { this.deliveryFilter = 'Exceptions'; this.deliveryPage = 1; }
  deliveryStatusCount(status: DeliveryStatus): number { return this.deliveries.filter(delivery => delivery.status === status).length; }
  selectDeliveryFilter(filter: string): void {
    if (filter === 'Exceptions') this.filterExceptions();
    else this.filterDeliveries(filter as DeliveryStatus | 'All');
  }
  deliveryFilterCount(filter: string): number {
    if (filter === 'All') return this.deliveries.length;
    if (filter === 'Exceptions') return this.exceptionDeliveries;
    return this.deliveryStatusCount(filter as DeliveryStatus);
  }
  searchDeliveries(value: string): void { this.deliverySearch = value; this.deliveryPage = 1; }
  setDeliverySort(value: 'recent' | 'oldest' | 'customer'): void { this.deliverySort = value; this.deliveryPage = 1; }
  setDeliveryPage(page: number): void { this.deliveryPage = Math.max(1, Math.min(page, this.deliveryPageCount)); }
  primaryDeliveryAction(status: DeliveryStatus): 'In Transit' | 'Delivered' | 'Failed' | 'Returned' | null {
    if (status === 'Prepared' || status === 'Failed') return 'In Transit';
    if (status === 'In Transit') return 'Delivered';
    return null;
  }
  primaryDeliveryLabel(status: DeliveryStatus): string {
    if (status === 'Prepared') return 'Dispatch';
    if (status === 'Failed') return 'Retry delivery';
    if (status === 'In Transit') return 'Mark delivered';
    return '';
  }
  deliveryStatusClass(status: DeliveryStatus): string {
    const classes: Record<DeliveryStatus, string> = {
      Prepared: 'delivery-status--prepared',
      'In Transit': 'delivery-status--transit',
      Delivered: 'delivery-status--delivered',
      Failed: 'delivery-status--failed',
      Returned: 'delivery-status--returned'
    };
    return classes[status];
  }
  deliveryRangeStart(): number { return this.filteredDeliveries.length ? (this.deliveryPage - 1) * this.deliveryPageSize + 1 : 0; }
  deliveryRangeEnd(): number { return Math.min(this.deliveryPage * this.deliveryPageSize, this.filteredDeliveries.length); }
  closeDeliveryEditor(): void { this.selectedDelivery = null; }
  saveDeliveryDetails(): void {
    if (!this.selectedDelivery || this.busyId) return;
    const delivery = this.selectedDelivery;
    this.busyId = delivery._id;
    this.errorMessage = '';
    this.notice = '';
    this.ops.updateDelivery(delivery._id, this.deliveryDraft).subscribe({
      next: ({ delivery: updated }) => {
        this.deliveries = this.deliveries.map(existing => existing._id === updated._id ? updated : existing);
        this.notice = `${updated.challanNumber} shipment details saved.`;
        this.selectedDelivery = null; this.busyId = ''; this.cdr.markForCheck();
      },
      error: error => { this.errorMessage = error?.error?.message ?? 'Unable to save shipment details.'; this.busyId = ''; this.cdr.markForCheck(); }
    });
  }
  addLine(): void { this.lines = [...this.lines, blankLine()]; }
  removeLine(index: number): void { this.lines = this.lines.filter((_line, i) => i !== index); }

  postStockDocument(): void {
    if (this.saving) return;
    const payload: StockDocumentPayload = {
      type: this.documentType,
      partyName: this.partyName.trim(),
      reference: this.reference.trim(),
      notes: this.notes.trim(),
      lines: this.lines.map(line => ({
        inventoryItemId: line.inventoryItemId,
        quantity: Number(line.quantity),
        ...(this.mode === 'adjustment' ? { direction: line.direction } : {})
      }))
    };
    this.saving = true;
    this.errorMessage = '';
    this.notice = '';
    this.ops.createStockDocument(payload).subscribe({
      next: ({ document }) => {
        this.documents = [document, ...this.documents];
        this.inventoryApi.getItems().subscribe({ next: response => { this.inventory = response.items ?? []; this.cdr.markForCheck(); } });
        this.notice = `${document.documentNumber} posted. Inventory balances are updated.`;
        this.resetForm();
        this.saving = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to post stock document.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  changeDelivery(delivery: OperationsModule['deliveries'][number], status: 'In Transit' | 'Delivered' | 'Failed' | 'Returned'): void {
    if (this.busyId) return;
    this.busyId = delivery._id;
    this.errorMessage = '';
    this.notice = '';
    this.ops.updateDelivery(delivery._id, { status }).subscribe({
      next: ({ delivery: updated }) => {
        this.deliveries = this.deliveries.map(existing => existing._id === updated._id ? updated : existing);
        if (this.selectedDelivery?._id === updated._id) this.selectedDelivery = updated;
        this.notice = `${updated.deliveryNumber} marked ${updated.status.toLowerCase()}.`;
        this.busyId = ''; this.cdr.markForCheck();
      },
      error: error => { this.errorMessage = error?.error?.message ?? 'Unable to update delivery status.'; this.busyId = ''; this.cdr.markForCheck(); }
    });
  }

  nextDeliveryStatuses(status: string): ('In Transit' | 'Delivered' | 'Failed' | 'Returned')[] {
    if (status === 'Prepared') return ['In Transit', 'Failed'];
    if (status === 'In Transit') return ['Delivered', 'Failed', 'Returned'];
    if (status === 'Failed') return ['In Transit', 'Returned'];
    return [];
  }

  documentLineCount(document: StockDocument): number { return document.lines.reduce((sum, line) => sum + line.quantity, 0); }
  documentValueFor(document: StockDocument): number {
    return document.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  }
  documentValue(direction: 'In' | 'Out'): number {
    return this.documents.reduce((sum, document) => sum + document.lines
      .filter(line => line.direction === direction)
      .reduce((lineSum, line) => lineSum + line.quantity * line.unitCost, 0), 0);
  }
  movementRows(): { label: string; quantity: number; value: number }[] {
    const totals = new Map<string, { quantity: number; value: number }>();
    for (const document of this.documents) for (const line of document.lines) {
      const row = totals.get(line.sku) ?? { quantity: 0, value: 0 };
      row.quantity += line.direction === 'In' ? line.quantity : -line.quantity;
      row.value += line.direction === 'In' ? line.quantity * line.unitCost : -line.quantity * line.unitCost;
      totals.set(line.sku, row);
    }
    return [...totals.entries()].map(([label, value]) => ({ label, ...value })).sort((a, b) => Math.abs(b.quantity) - Math.abs(a.quantity)).slice(0, 10);
  }

  exportInventoryCsv(): void {
    const rows = [
      ['SKU', 'Item', 'Category', 'On hand', 'Reorder level', 'Unit cost', 'Stock value', 'Location'],
      ...this.inventory.map(item => [item.sku, item.name, item.category, String(item.quantityOnHand), String(item.reorderLevel), String(item.unitCost), String(item.quantityOnHand * item.unitCost), item.location])
    ];
    this.downloadCsv(rows, 'inventory-report.csv');
  }

  private resetForm(): void {
    this.partyName = ''; this.reference = ''; this.notes = ''; this.lines = [blankLine()];
  }

  private downloadCsv(rows: string[][], name: string): void {
    const csv = rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
  }
}
