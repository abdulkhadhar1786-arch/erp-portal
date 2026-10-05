import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base';

export type SpareRequestStatus = 'Requested' | 'Partially Issued' | 'Issuing' | 'Issued' | 'Rejected';
export type DefectiveReturnStatus = 'Submitted' | 'Received' | 'Rejected';

export interface SpareRequest {
  _id: string;
  requestNumber: string;
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  branchId: string;
  branchName: string;
  inventoryItemId: string;
  sku: string;
  itemName: string;
  unit: string;
  unitCost: number;
  quantityRequested: number;
  quantityIssued: number;
  reason: string;
  requestedBy: string;
  status: SpareRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SpareIssue {
  _id: string;
  issueNumber: string;
  requestId: string;
  requestNumber: string;
  ticketId: string;
  ticketNumber: string;
  inventoryItemId: string;
  sku: string;
  itemName: string;
  unit: string;
  unitCost: number;
  quantity: number;
  returnedQuantity: number;
  customerName: string;
  branchName: string;
  issuedBy: string;
  notes: string;
  issuedAt: string;
  createdAt: string;
}

export interface DefectiveReturn {
  _id: string;
  returnNumber: string;
  issueId: string;
  issueNumber: string;
  ticketId: string;
  ticketNumber: string;
  inventoryItemId: string;
  sku: string;
  itemName: string;
  customerName: string;
  branchName: string;
  quantity: number;
  reason: string;
  status: DefectiveReturnStatus;
  submittedBy: string;
  receivedBy: string;
  receivedAt: string | null;
  createdAt: string;
}

export interface SpareRequestPayload {
  ticketId: string;
  inventoryItemId: string;
  quantityRequested: number;
  reason: string;
}

export interface BulkInventoryResult {
  success: boolean;
  importedCount: number;
  createdCount: number;
  updatedCount: number;
  preservedStockCount: number;
}

@Injectable({ providedIn: 'root' })
export class SpareService {
  private readonly apiUrl = `${API_BASE_URL}/spares`;
  private readonly options = { withCredentials: true } as const;

  constructor(private http: HttpClient) {}

  getRequests(): Observable<{ success: boolean; count: number; requests: SpareRequest[] }> {
    return this.http.get<{ success: boolean; count: number; requests: SpareRequest[] }>(`${this.apiUrl}/requests`, this.options);
  }

  createRequest(payload: SpareRequestPayload): Observable<{ success: boolean; request: SpareRequest }> {
    return this.http.post<{ success: boolean; request: SpareRequest }>(`${this.apiUrl}/requests`, payload, this.options);
  }

  rejectRequest(id: string): Observable<{ success: boolean; request: SpareRequest }> {
    return this.http.patch<{ success: boolean; request: SpareRequest }>(`${this.apiUrl}/requests/${encodeURIComponent(id)}/reject`, {}, this.options);
  }

  getIssues(): Observable<{ success: boolean; count: number; issues: SpareIssue[] }> {
    return this.http.get<{ success: boolean; count: number; issues: SpareIssue[] }>(`${this.apiUrl}/issues`, this.options);
  }

  issueRequest(id: string, quantity: number, notes: string): Observable<{ success: boolean; issue: SpareIssue; request: SpareRequest }> {
    return this.http.post<{ success: boolean; issue: SpareIssue; request: SpareRequest }>(
      `${this.apiUrl}/requests/${encodeURIComponent(id)}/issue`, { quantity, notes }, this.options
    );
  }

  getReturns(): Observable<{ success: boolean; count: number; returns: DefectiveReturn[] }> {
    return this.http.get<{ success: boolean; count: number; returns: DefectiveReturn[] }>(`${this.apiUrl}/returns`, this.options);
  }

  createReturn(payload: { issueId: string; quantity: number; reason: string }): Observable<{ success: boolean; return: DefectiveReturn }> {
    return this.http.post<{ success: boolean; return: DefectiveReturn }>(`${this.apiUrl}/returns`, payload, this.options);
  }

  updateReturn(id: string, status: 'Received' | 'Rejected'): Observable<{ success: boolean; return: DefectiveReturn }> {
    return this.http.patch<{ success: boolean; return: DefectiveReturn }>(`${this.apiUrl}/returns/${encodeURIComponent(id)}`, { status }, this.options);
  }
}
