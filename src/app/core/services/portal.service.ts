import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-base';
import { Observable } from 'rxjs';
import type { TicketHistoryEvent } from './ticket.service';

export type PortalRole = 'customer_admin' | 'branch';

export interface PortalTicket {
  _id: string;
  ticketNumber: string;
  customerName: string;
  branchName: string;
  subject: string;
  category: string;
  reportedBy?: string;
  contactEmail?: string;
  contactPhone?: string;
  assetReference?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'New' | 'Assigned' | 'In Progress' | 'On Hold' | 'Resolved' | 'Closed';
  description: string;
  createdAt: string;
  updatedAt: string;
  history?: TicketHistoryEvent[];
}

export interface PortalBranch {
  _id: string;
  code: string;
  name: string;
  city: string;
  status: 'Active' | 'Inactive';
}

export interface PortalDashboard {
  success: boolean;
  role: PortalRole;
  account: {
    _id: string;
    code?: string;
    name?: string;
    email?: string;
    phone?: string;
    contactPerson?: string;
    industry?: string;
    website?: string;
    city?: string;
    address?: string;
    customer?: string;
    customerCode?: string;
  };
  stats: { totalTickets: number; openTickets: number; branchCount?: number };
  branches?: PortalBranch[];
  recentTickets: PortalTicket[];
}

export interface PortalTicketPayload {
  subject: string;
  category: string;
  priority: PortalTicket['priority'];
  description: string;
  reportedBy?: string;
  contactEmail?: string;
  contactPhone?: string;
  assetReference?: string;
  branchId?: string;
}

@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly apiUrl = `${API_BASE_URL}/portal`;
  private readonly options = { withCredentials: true } as const;

  constructor(private http: HttpClient) {}

  getDashboard(role: PortalRole): Observable<PortalDashboard> {
    return this.http.get<PortalDashboard>(`${this.apiUrl}/${this.scope(role)}/dashboard`, this.options);
  }

  getTickets(role: PortalRole): Observable<{ success: boolean; tickets: PortalTicket[]; count: number }> {
    return this.http.get<{ success: boolean; tickets: PortalTicket[]; count: number }>(
      `${this.apiUrl}/${this.scope(role)}/tickets`, this.options
    );
  }

  getTicket(role: PortalRole, id: string): Observable<{ success: boolean; ticket: PortalTicket }> {
    return this.http.get<{ success: boolean; ticket: PortalTicket }>(
      `${this.apiUrl}/${this.scope(role)}/tickets/${encodeURIComponent(id)}`, this.options
    );
  }

  createTicket(role: PortalRole, payload: PortalTicketPayload): Observable<{ success: boolean; ticket: PortalTicket }> {
    return this.http.post<{ success: boolean; ticket: PortalTicket }>(
      `${this.apiUrl}/${this.scope(role)}/tickets`, payload, this.options
    );
  }

  private scope(role: PortalRole): string {
    return role === 'customer_admin' ? 'customer' : 'branch';
  }
}
