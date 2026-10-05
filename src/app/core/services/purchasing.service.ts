import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base';

export type PurchaseOrderStatus = 'Draft' | 'Placed' | 'Receiving' | 'Partially Received' | 'Received' | 'Cancelled';

export interface Vendor {
  _id: string;
  vendorCode: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  taxNumber: string;
  address: string;
  status: 'Active' | 'Inactive';
}

export type VendorPayload = Omit<Vendor, '_id'>;

export interface PurchaseOrderLine {
  inventoryItemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

export interface PurchaseOrder {
  _id: string;
  purchaseOrderNumber: string;
  vendorId: string;
  vendorName: string;
  orderDate: string;
  expectedDate: string | null;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  notes: string;
  createdAt: string;
}

export interface PurchaseOrderPayload {
  vendorId: string;
  expectedDate: string;
  notes: string;
  lines: { inventoryItemId: string; quantityOrdered: number; unitCost: number }[];
}

@Injectable({ providedIn: 'root' })
export class PurchasingService {
  private readonly apiUrl = `${API_BASE_URL}/purchasing`;
  private readonly options = { withCredentials: true } as const;

  constructor(private http: HttpClient) {}

  getVendors(): Observable<{ success: boolean; count: number; vendors: Vendor[] }> {
    return this.http.get<{ success: boolean; count: number; vendors: Vendor[] }>(`${this.apiUrl}/vendors`, this.options);
  }
  createVendor(payload: VendorPayload): Observable<{ success: boolean; vendor: Vendor }> {
    return this.http.post<{ success: boolean; vendor: Vendor }>(`${this.apiUrl}/vendors`, payload, this.options);
  }
  updateVendor(id: string, payload: VendorPayload): Observable<{ success: boolean; vendor: Vendor }> {
    return this.http.put<{ success: boolean; vendor: Vendor }>(`${this.apiUrl}/vendors/${encodeURIComponent(id)}`, payload, this.options);
  }
  getOrders(): Observable<{ success: boolean; count: number; orders: PurchaseOrder[] }> {
    return this.http.get<{ success: boolean; count: number; orders: PurchaseOrder[] }>(`${this.apiUrl}/purchase-orders`, this.options);
  }
  createOrder(payload: PurchaseOrderPayload): Observable<{ success: boolean; order: PurchaseOrder }> {
    return this.http.post<{ success: boolean; order: PurchaseOrder }>(`${this.apiUrl}/purchase-orders`, payload, this.options);
  }
  updateOrderStatus(id: string, status: 'Placed' | 'Cancelled'): Observable<{ success: boolean; order: PurchaseOrder }> {
    return this.http.patch<{ success: boolean; order: PurchaseOrder }>(`${this.apiUrl}/purchase-orders/${encodeURIComponent(id)}/status`, { status }, this.options);
  }
  receiveOrder(id: string, lines: { lineIndex: number; quantity: number }[]): Observable<{ success: boolean; order: PurchaseOrder }> {
    return this.http.post<{ success: boolean; order: PurchaseOrder }>(`${this.apiUrl}/purchase-orders/${encodeURIComponent(id)}/receive`, { lines }, this.options);
  }
}
