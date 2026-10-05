import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base';

export const LEAD_STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const;
export type LeadStage = typeof LEAD_STAGES[number];

export const LEAD_SOURCES = ['Website', 'Referral', 'Outbound', 'Partner', 'Event', 'Other'] as const;
export type LeadSource = typeof LEAD_SOURCES[number];

export interface CrmLead {
  _id: string;
  leadNumber: string;
  companyName: string;
  contactName: string;
  contactTitle?: string;
  email: string;
  phone: string;
  industry: string;
  source: LeadSource;
  stage: LeadStage;
  expectedValue: number;
  probability?: number;
  targetCloseDate?: string | null;
  campaign?: string;
  competitor?: string;
  lostReason?: string;
  owner: string;
  nextFollowUp: string | null;
  notes: string;
  customerId?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeadPayload = Omit<CrmLead, '_id' | 'leadNumber' | 'customerId' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class CrmService {
  private readonly apiUrl = `${API_BASE_URL}/crm/leads`;
  private readonly options = { withCredentials: true } as const;

  constructor(private http: HttpClient) {}

  getLeads(): Observable<{ success: boolean; count: number; leads: CrmLead[] }> {
    return this.http.get<{ success: boolean; count: number; leads: CrmLead[] }>(this.apiUrl, this.options);
  }

  createLead(payload: LeadPayload): Observable<{ success: boolean; lead: CrmLead }> {
    return this.http.post<{ success: boolean; lead: CrmLead }>(this.apiUrl, payload, this.options);
  }

  updateLead(id: string, payload: LeadPayload): Observable<{ success: boolean; lead: CrmLead }> {
    return this.http.put<{ success: boolean; lead: CrmLead }>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      payload,
      this.options
    );
  }

  convertLeadToCustomer(id: string): Observable<{
    success: boolean;
    alreadyConverted: boolean;
    lead: CrmLead;
    customer: { _id: string; code: string; name: string };
  }> {
    return this.http.post<{
      success: boolean;
      alreadyConverted: boolean;
      lead: CrmLead;
      customer: { _id: string; code: string; name: string };
    }>(`${this.apiUrl}/${encodeURIComponent(id)}/convert-to-customer`, {}, this.options);
  }
}
