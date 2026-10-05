import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base';

export type StockDocumentType = 'Goods Receipt' | 'Delivery Challan' | 'Inventory Adjustment' | 'Inward Challan' | 'Outward Challan';
export type StockDirection = 'In' | 'Out';
export type AssetStatus = 'Active' | 'In Repair' | 'Retired';
export type DeliveryStatus = 'Prepared' | 'In Transit' | 'Delivered' | 'Failed' | 'Returned';
export type DeliveryUpdate = Partial<Pick<DeliveryRecord, 'status' | 'recipient' | 'carrier' | 'trackingNumber'>>;
export type InvoiceStatus = 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Voided';
export type ExpenseStatus = 'Draft' | 'Approved' | 'Paid' | 'Rejected';

export interface StockDocumentLine {
  inventoryItemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantity: number;
  direction: StockDirection;
  unitCost: number;
}

export interface StockDocument {
  _id: string;
  documentNumber: string;
  type: StockDocumentType;
  partyName: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  salesOrderId: string;
  salesOrderNumber: string;
  reference: string;
  notes: string;
  lines: StockDocumentLine[];
  createdBy: string;
  postedAt: string;
  createdAt: string;
}

export interface StockDocumentPayload {
  type: 'Inventory Adjustment';
  partyName: string;
  reference: string;
  notes: string;
  lines: { inventoryItemId: string; quantity: number; direction?: StockDirection }[];
}

export interface DeliveryRecord {
  _id: string;
  deliveryNumber: string;
  stockDocumentId: string;
  challanNumber: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  customerName: string;
  recipient: string;
  carrier: string;
  trackingNumber: string;
  status: DeliveryStatus;
  deliveredAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface AssetRecord {
  _id: string;
  assetTag: string;
  serialNumber: string;
  name: string;
  deviceType: string;
  status: AssetStatus;
  customerId: string;
  customerName: string;
  branchName: string;
  supplier: string;
  purchaseDate: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetPayload = Omit<AssetRecord, '_id' | 'customerName' | 'createdAt' | 'updatedAt'>;

export interface BundleComponent {
  inventoryItemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantity: number;
}

export interface BundleProduct {
  _id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  salePrice: number;
  status: 'Active' | 'Inactive';
  components: BundleComponent[];
  createdAt: string;
  updatedAt: string;
}

export type BundlePayload = Omit<BundleProduct, '_id' | 'createdAt' | 'updatedAt'>;

export interface ExpenseVoucher {
  _id: string;
  voucherNumber: string;
  voucherDate: string;
  category: string;
  payee: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  description: string;
  status: ExpenseStatus;
  createdBy: string;
  approvedBy: string;
  paidAt: string | null;
  createdAt: string;
}

export interface ExpensePayload {
  voucherDate: string;
  category: string;
  payee: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  description: string;
}

export interface SalesInvoice {
  _id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string | null;
  subTotal: number;
  discountAmount?: number;
  taxAmount: number;
  roundOff?: number;
  total: number;
  amountPaid?: number;
  payments?: InvoicePayment[];
  status: InvoiceStatus;
  description?: string;
  notes: string;
  createdBy: string;
  paidAt: string | null;
  createdAt: string;
}

export interface InvoicePayment {
  amount: number;
  paymentDate: string;
  method: string;
  reference: string;
  notes: string;
  receivedBy: string;
}

export interface InvoicePaymentPayload {
  amount: number;
  paymentDate: string;
  method: string;
  reference: string;
  notes: string;
}

@Injectable({ providedIn: 'root' })
export class OperationsService {
  private readonly apiUrl = `${API_BASE_URL}/operations`;
  private readonly options = { withCredentials: true } as const;

  constructor(private http: HttpClient) {}

  getStockDocuments(): Observable<{ success: boolean; count: number; documents: StockDocument[] }> {
    return this.http.get<{ success: boolean; count: number; documents: StockDocument[] }>(`${this.apiUrl}/stock-documents`, this.options);
  }
  createStockDocument(payload: StockDocumentPayload): Observable<{ success: boolean; document: StockDocument }> {
    return this.http.post<{ success: boolean; document: StockDocument }>(`${this.apiUrl}/stock-documents`, payload, this.options);
  }
  getDeliveries(): Observable<{ success: boolean; count: number; deliveries: DeliveryRecord[] }> {
    return this.http.get<{ success: boolean; count: number; deliveries: DeliveryRecord[] }>(`${this.apiUrl}/deliveries`, this.options);
  }
  updateDelivery(id: string, update: DeliveryUpdate): Observable<{ success: boolean; delivery: DeliveryRecord }> {
    return this.http.patch<{ success: boolean; delivery: DeliveryRecord }>(`${this.apiUrl}/deliveries/${encodeURIComponent(id)}`, update, this.options);
  }
  getAssets(): Observable<{ success: boolean; count: number; assets: AssetRecord[] }> {
    return this.http.get<{ success: boolean; count: number; assets: AssetRecord[] }>(`${this.apiUrl}/assets`, this.options);
  }
  createAsset(payload: AssetPayload): Observable<{ success: boolean; asset: AssetRecord }> {
    return this.http.post<{ success: boolean; asset: AssetRecord }>(`${this.apiUrl}/assets`, payload, this.options);
  }
  updateAsset(id: string, payload: AssetPayload): Observable<{ success: boolean; asset: AssetRecord }> {
    return this.http.put<{ success: boolean; asset: AssetRecord }>(`${this.apiUrl}/assets/${encodeURIComponent(id)}`, payload, this.options);
  }
  getBundles(): Observable<{ success: boolean; count: number; bundles: BundleProduct[] }> {
    return this.http.get<{ success: boolean; count: number; bundles: BundleProduct[] }>(`${this.apiUrl}/bundles`, this.options);
  }
  createBundle(payload: BundlePayload): Observable<{ success: boolean; bundle: BundleProduct }> {
    return this.http.post<{ success: boolean; bundle: BundleProduct }>(`${this.apiUrl}/bundles`, payload, this.options);
  }
  updateBundle(id: string, payload: BundlePayload): Observable<{ success: boolean; bundle: BundleProduct }> {
    return this.http.put<{ success: boolean; bundle: BundleProduct }>(`${this.apiUrl}/bundles/${encodeURIComponent(id)}`, payload, this.options);
  }
  getExpenses(): Observable<{ success: boolean; count: number; vouchers: ExpenseVoucher[] }> {
    return this.http.get<{ success: boolean; count: number; vouchers: ExpenseVoucher[] }>(`${this.apiUrl}/expenses`, this.options);
  }
  createExpense(payload: ExpensePayload): Observable<{ success: boolean; voucher: ExpenseVoucher }> {
    return this.http.post<{ success: boolean; voucher: ExpenseVoucher }>(`${this.apiUrl}/expenses`, payload, this.options);
  }
  updateExpense(id: string, status: ExpenseStatus): Observable<{ success: boolean; voucher: ExpenseVoucher }> {
    return this.http.patch<{ success: boolean; voucher: ExpenseVoucher }>(`${this.apiUrl}/expenses/${encodeURIComponent(id)}`, { status }, this.options);
  }
  getInvoices(): Observable<{ success: boolean; count: number; invoices: SalesInvoice[] }> {
    return this.http.get<{ success: boolean; count: number; invoices: SalesInvoice[] }>(`${this.apiUrl}/invoices`, this.options);
  }
  createInvoice(orderId: string, dueDate: string, description: string): Observable<{ success: boolean; invoice: SalesInvoice }> {
    return this.http.post<{ success: boolean; invoice: SalesInvoice }>(`${this.apiUrl}/invoices`, { orderId, dueDate: dueDate || null, description }, this.options);
  }
  updateInvoice(id: string, status: InvoiceStatus): Observable<{ success: boolean; invoice: SalesInvoice }> {
    return this.http.patch<{ success: boolean; invoice: SalesInvoice }>(`${this.apiUrl}/invoices/${encodeURIComponent(id)}`, { status }, this.options);
  }
  recordInvoicePayment(id: string, payload: InvoicePaymentPayload): Observable<{ success: boolean; invoice: SalesInvoice }> {
    return this.http.post<{ success: boolean; invoice: SalesInvoice }>(`${this.apiUrl}/invoices/${encodeURIComponent(id)}/payments`, payload, this.options);
  }
}
