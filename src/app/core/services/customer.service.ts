import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-base';
import { Observable } from 'rxjs';

export type CustomerStatus = 'Active' | 'On Hold' | 'Blacklisted' | 'Inactive';
export type BranchStatus = 'Active' | 'Inactive';

export interface CustomerAddress {
  building: string;
  street: string;
  area: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

export interface CustomerSummary {
  _id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  contactPerson?: string;
  industry?: string;
  website?: string;
  tradeName?: string;
  customerType?: string;
  designation?: string;
  secondaryContactName?: string;
  secondaryContactDesignation?: string;
  secondaryContactPhone?: string;
  secondaryContactEmail?: string;
  department?: string;
  billingAddress?: CustomerAddress;
  shippingAddress?: CustomerAddress;
  branchOfficeName?: string;
  gstin?: string;
  gstRegistrationType?: string;
  placeOfSupplyCode?: string;
  pan?: string;
  tan?: string;
  udyamNumber?: string;
  lutNumber?: string;
  iecCode?: string;
  paymentTerms?: string;
  creditDays?: number;
  creditLimit?: number;
  currency?: string;
  discountPercentage?: number;
  priceListTier?: string;
  preferredPaymentMethod?: string;
  bankAccountHolderName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranchName?: string;
  accountManager?: string;
  assignedBranch?: string;
  contractDetails?: string;
  contractRenewalDate?: string | null;
  contractExpiryDate?: string | null;
  internalNotes?: string;
  address: string;
  city: string;
  status: CustomerStatus;
  portalUsername?: string;
  branchCount: number;
  openTickets: number;
}

export interface BranchRecord {
  _id: string;
  customerId: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  username: string;
  status: BranchStatus;
  openTickets?: number;
  customer?: string;
}

export interface CustomerDetails extends Omit<CustomerSummary, 'branchCount'> {
  totalTickets: number;
  branches: BranchRecord[];
}

export interface CustomerPayload {
  name: string;
  email: string;
  phone: string;
  contactPerson?: string;
  industry?: string;
  website?: string;
  tradeName?: string;
  customerType?: string;
  designation?: string;
  secondaryContactName?: string;
  secondaryContactDesignation?: string;
  secondaryContactPhone?: string;
  secondaryContactEmail?: string;
  department?: string;
  billingAddress?: CustomerAddress;
  shippingAddress?: CustomerAddress;
  branchOfficeName?: string;
  gstin?: string;
  gstRegistrationType?: string;
  placeOfSupplyCode?: string;
  pan?: string;
  tan?: string;
  udyamNumber?: string;
  lutNumber?: string;
  iecCode?: string;
  paymentTerms?: string;
  creditDays?: number;
  creditLimit?: number;
  currency?: string;
  discountPercentage?: number;
  priceListTier?: string;
  preferredPaymentMethod?: string;
  bankAccountHolderName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankBranchName?: string;
  accountManager?: string;
  assignedBranch?: string;
  contractDetails?: string;
  contractRenewalDate?: string | null;
  contractExpiryDate?: string | null;
  internalNotes?: string;
  address: string;
  city: string;
  status: CustomerStatus;
  portalUsername?: string;
  portalPassword?: string;
}

export interface BranchPayload {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  username: string;
  password?: string;
  status: BranchStatus;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly apiUrl = `${API_BASE_URL}/customers`;
  private readonly requestOptions = { withCredentials: true } as const;

  constructor(private http: HttpClient) {}

  getCustomers(): Observable<{
    success: boolean;
    count: number;
    customers: CustomerSummary[];
  }> {
    return this.http.get<{
      success: boolean;
      count: number;
      customers: CustomerSummary[];
    }>(this.apiUrl, this.requestOptions);
  }

  getCustomer(id: string): Observable<{ success: boolean; customer: CustomerDetails }> {
    return this.http.get<{ success: boolean; customer: CustomerDetails }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      this.requestOptions
    );
  }

  createCustomer(payload: CustomerPayload): Observable<{
    success: boolean;
    customer: CustomerSummary;
  }> {
    return this.http.post<{ success: boolean; customer: CustomerSummary }>(
      this.apiUrl,
      payload,
      this.requestOptions
    );
  }

  updateCustomer(id: string, payload: CustomerPayload): Observable<{
    success: boolean;
    customer: CustomerSummary;
  }> {
    return this.http.put<{ success: boolean; customer: CustomerSummary }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      payload,
      this.requestOptions
    );
  }

  getBranches(customerId: string): Observable<{
    success: boolean;
    count: number;
    branches: BranchRecord[];
  }> {
    return this.http.get<{
      success: boolean;
      count: number;
      branches: BranchRecord[];
    }>(
      `${this.apiUrl}/${encodeURIComponent(customerId)}/branches`,
      this.requestOptions
    );
  }

  getBranch(customerId: string, branchId: string): Observable<{
    success: boolean;
    branch: BranchRecord;
  }> {
    return this.http.get<{ success: boolean; branch: BranchRecord }>(
      `${this.apiUrl}/${encodeURIComponent(customerId)}/branches/${encodeURIComponent(branchId)}`,
      this.requestOptions
    );
  }

  createBranch(customerId: string, payload: BranchPayload): Observable<{
    success: boolean;
    branch: BranchRecord;
  }> {
    return this.http.post<{ success: boolean; branch: BranchRecord }>(
      `${this.apiUrl}/${encodeURIComponent(customerId)}/branches`,
      payload,
      this.requestOptions
    );
  }

  updateBranch(customerId: string, branchId: string, payload: BranchPayload): Observable<{
    success: boolean;
    branch: BranchRecord;
  }> {
    return this.http.put<{ success: boolean; branch: BranchRecord }>(
      `${this.apiUrl}/${encodeURIComponent(customerId)}/branches/${encodeURIComponent(branchId)}`,
      payload,
      this.requestOptions
    );
  }
}
