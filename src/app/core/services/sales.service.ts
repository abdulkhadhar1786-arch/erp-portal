import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base';

export const QUOTE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'] as const;
export type QuoteStatus = typeof QUOTE_STATUSES[number];

export const SALES_ORDER_STATUSES = ['Confirmed', 'Processing', 'Partially Fulfilled', 'Fulfilling', 'Fulfilled', 'Cancelled'] as const;
export type SalesOrderStatus = typeof SALES_ORDER_STATUSES[number];

export interface FulfillmentOption {
  inventoryItemId: string;
  sku: string;
  name: string;
  unit: string;
  orderedQuantity: number;
  issuedQuantity: number;
  remainingQuantity: number;
  availableQuantity: number;
  active: boolean;
}

export interface FulfillmentDocumentSummary {
  _id: string;
  documentNumber: string;
  createdAt: string;
}

export interface SalesLineItem {
  inventoryItemId: string;
  sku: string;
  hsnCode?: string;
  name: string;
  description: string;
  unit: string;
  warranty?: string;
  brand?: string;
  modelNumber?: string;
  specifications?: string;
  serialNumber?: string;
  condition?: string;
  location?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface QuoteProfile {
  companyName: string;
  companyAddress: string;
  companyState: string;
  companyPhone: string;
  companyEmail: string;
  companyWebsite: string;
  companyPan: string;
  companyGstin: string;
  companyMsme: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranch: string;
  bankIfsc: string;
  contactName: string;
  contactPhone: string;
  contactMobile: string;
  contactEmail: string;
  authorizedSignatory: string;
  defaultValidityDays: number;
  defaultTerms: string;
}

export interface QuoteProposalDetails {
  paymentTerms: string;
  paymentMilestones: string;
  deliveryMethod: string;
  deliverySchedule: string;
  freightCharges: number;
  warrantyPeriod: string;
  returnPolicy: string;
  rentalStartDate: string;
  rentalEndDate: string;
  rentalBillingCycle: string;
  securityDeposit: number;
  rentalConditions: string;
  rentalUsageLimit: string;
  maintenanceResponsibility: string;
  damageLiability: string;
  returnConditions: string;
  coverageType: string;
  responseSla: string;
  resolutionSla: string;
  serviceWindow: string;
  preventiveMaintenanceFrequency: string;
  preventiveVisitsPerYear: number;
  contractStartDate: string;
  contractEndDate: string;
  exclusions: string;
  monoRate: number;
  colorRate: number;
  minimumMonoPages: number;
  minimumColorPages: number;
  mpsBillingFrequency: string;
  meterReadingProcess: string;
  monoOverageRate: number;
  colorOverageRate: number;
  includedServices: string;
  serviceScope: string;
  supportTiers: string;
  supportAvailability: string;
  vendorEscalationContact: string;
  includedEngineerHours: number;
  pricingBasis: string;
  serviceRate: number;
  escalationPath: string;
  operationalBoundaries: string;
  visitFee: number;
  visitScope: string;
  visitDate: string;
  hourlyLaborRate: number;
  laborHours: number;
  includedLaborHours: number;
  travelCharges: number;
  travelDistanceKm: number;
  emergencyCharges: number;
}

export interface SalesQuote {
  _id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  branchId?: string;
  branchCode?: string;
  branchName?: string;
  branchAddress?: string;
  branchCity?: string;
  branchState?: string;
  branchPincode?: string;
  branchEmail?: string;
  branchPhone?: string;
  customerBillingAddress?: string;
  customerShippingAddress?: string;
  customerState?: string;
  customerGstin?: string;
  customerPan?: string;
  proposalType?: string;
  warrantyType?: string;
  warrantyFrom?: string;
  installationBy?: string;
  preventiveMaintenance?: string;
  proposalDetails?: QuoteProposalDetails;
  lineItems: SalesLineItem[];
  subTotal: number;
  discountRate?: number;
  discountAmount?: number;
  taxRate: number;
  taxAmount: number;
  roundOff?: number;
  total: number;
  validUntil: string | null;
  notes: string;
  termsAndConditions?: string;
  sellerSnapshot?: QuoteProfile;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLinePayload {
  inventoryItemId?: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  hsnCode: string;
  warranty: string;
  brand?: string;
  modelNumber?: string;
  specifications?: string;
  serialNumber?: string;
  condition?: string;
  location?: string;
  quantity: number;
  unitPrice: number;
}

export interface QuotePayload {
  customerId: string;
  branchId?: string;
  proposalDetails: QuoteProposalDetails;
  lineItems: QuoteLinePayload[];
  discountRate: number;
  taxRate: number;
  validUntil: string | null;
  proposalType: string;
  warrantyType: string;
  warrantyFrom: string;
  installationBy: string;
  preventiveMaintenance: string;
  notes: string;
  termsAndConditions: string;
}

export interface SalesOrder {
  _id: string;
  orderNumber: string;
  quoteId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  branchId?: string;
  branchCode?: string;
  branchName?: string;
  branchAddress?: string;
  branchCity?: string;
  branchState?: string;
  branchPincode?: string;
  branchEmail?: string;
  branchPhone?: string;
  customerBillingAddress?: string;
  customerShippingAddress?: string;
  customerState?: string;
  customerGstin?: string;
  customerPan?: string;
  proposalType?: string;
  proposalDetails?: QuoteProposalDetails;
  sellerSnapshot?: QuoteProfile;
  lineItems: SalesLineItem[];
  subTotal: number;
  discountRate?: number;
  discountAmount?: number;
  taxRate: number;
  taxAmount: number;
  roundOff?: number;
  total: number;
  orderDate: string;
  notes: string;
  termsAndConditions?: string;
  status: SalesOrderStatus;
  fulfillmentDocumentId?: string;
  fulfillmentDocumentNumber?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly apiUrl = `${API_BASE_URL}/sales`;
  private readonly options = { withCredentials: true } as const;

  constructor(private http: HttpClient) {}

  getQuoteProfile(): Observable<{ success: boolean; profile: QuoteProfile }> {
    return this.http.get<{ success: boolean; profile: QuoteProfile }>(`${this.apiUrl}/quotes/profile`, this.options);
  }

  updateQuoteProfile(profile: QuoteProfile): Observable<{ success: boolean; profile: QuoteProfile }> {
    return this.http.put<{ success: boolean; profile: QuoteProfile }>(`${this.apiUrl}/quotes/profile`, profile, this.options);
  }

  getQuotes(): Observable<{ success: boolean; count: number; quotes: SalesQuote[] }> {
    return this.http.get<{ success: boolean; count: number; quotes: SalesQuote[] }>(`${this.apiUrl}/quotes`, this.options);
  }

  createQuote(payload: QuotePayload): Observable<{ success: boolean; quote: SalesQuote }> {
    return this.http.post<{ success: boolean; quote: SalesQuote }>(`${this.apiUrl}/quotes`, payload, this.options);
  }

  updateQuote(id: string, payload: QuotePayload): Observable<{ success: boolean; quote: SalesQuote }> {
    return this.http.put<{ success: boolean; quote: SalesQuote }>(
      `${this.apiUrl}/quotes/${encodeURIComponent(id)}`,
      payload,
      this.options
    );
  }

  updateQuoteStatus(id: string, status: QuoteStatus): Observable<{ success: boolean; quote: SalesQuote }> {
    return this.http.patch<{ success: boolean; quote: SalesQuote }>(
      `${this.apiUrl}/quotes/${encodeURIComponent(id)}/status`,
      { status },
      this.options
    );
  }

  renewQuote(id: string, validUntil: string): Observable<{ success: boolean; quote: SalesQuote }> {
    return this.http.patch<{ success: boolean; quote: SalesQuote }>(
      `${this.apiUrl}/quotes/${encodeURIComponent(id)}/renew`,
      { validUntil },
      this.options
    );
  }

  convertQuote(id: string): Observable<{ success: boolean; alreadyConverted: boolean; order: SalesOrder }> {
    return this.http.post<{ success: boolean; alreadyConverted: boolean; order: SalesOrder }>(
      `${this.apiUrl}/quotes/${encodeURIComponent(id)}/convert`,
      {},
      this.options
    );
  }

  getOrders(): Observable<{ success: boolean; count: number; orders: SalesOrder[] }> {
    return this.http.get<{ success: boolean; count: number; orders: SalesOrder[] }>(`${this.apiUrl}/orders`, this.options);
  }

  getFulfillmentOptions(id: string): Observable<{
    success: boolean;
    orderId: string;
    items: FulfillmentOption[];
    documents: FulfillmentDocumentSummary[];
  }> {
    return this.http.get<{
      success: boolean;
      orderId: string;
      items: FulfillmentOption[];
      documents: FulfillmentDocumentSummary[];
    }>(`${this.apiUrl}/orders/${encodeURIComponent(id)}/fulfillment-options`, this.options);
  }

  updateOrderStatus(id: string, status: SalesOrderStatus): Observable<{ success: boolean; order: SalesOrder }> {
    return this.http.patch<{ success: boolean; order: SalesOrder }>(
      `${this.apiUrl}/orders/${encodeURIComponent(id)}/status`,
      { status },
      this.options
    );
  }

  fulfillOrder(id: string, lines: { inventoryItemId: string; quantity: number }[]): Observable<{
    success: boolean;
    alreadyFulfilled: boolean;
    order: SalesOrder;
    stockDocument: { _id: string; documentNumber: string } | null;
    delivery: { _id: string; deliveryNumber: string; challanNumber: string; status: string } | null;
  }> {
    return this.http.post<{
      success: boolean;
      alreadyFulfilled: boolean;
      order: SalesOrder;
      stockDocument: { _id: string; documentNumber: string } | null;
      delivery: { _id: string; deliveryNumber: string; challanNumber: string; status: string } | null;
  }>(`${this.apiUrl}/orders/${encodeURIComponent(id)}/fulfill`, { lines }, this.options);
  }
}
