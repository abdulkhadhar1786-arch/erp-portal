import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base';
import type { BulkInventoryResult } from './spare.service';

export type InventoryStatus = 'Active' | 'Inactive';

export interface InventoryItem {
  _id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost: number;
  supplier: string;
  location: string;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
}

export type InventoryPayload = Omit<InventoryItem, '_id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = `${API_BASE_URL}/inventory/items`;
  private readonly options = { withCredentials: true } as const;

  constructor(private http: HttpClient) {}

  getItems(): Observable<{ success: boolean; count: number; items: InventoryItem[] }> {
    return this.http.get<{ success: boolean; count: number; items: InventoryItem[] }>(this.apiUrl, this.options);
  }

  createItem(payload: InventoryPayload): Observable<{ success: boolean; item: InventoryItem }> {
    return this.http.post<{ success: boolean; item: InventoryItem }>(this.apiUrl, payload, this.options);
  }

  bulkImport(items: InventoryPayload[]): Observable<BulkInventoryResult> {
    return this.http.post<BulkInventoryResult>(`${this.apiUrl}/bulk`, { items }, this.options);
  }

  updateItem(id: string, payload: InventoryPayload): Observable<{ success: boolean; item: InventoryItem }> {
    return this.http.put<{ success: boolean; item: InventoryItem }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      payload,
      this.options
    );
  }
}
