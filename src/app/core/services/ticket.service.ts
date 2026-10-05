import { Injectable } from '@angular/core';

import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import {
  Observable
} from 'rxjs';
import { API_BASE_URL } from '../api-base';


export type TicketPriority =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical';


export type TicketStatus =
  | 'New'
  | 'Assigned'
  | 'In Progress'
  | 'On Hold'
  | 'Resolved'
  | 'Closed';


export interface TicketAttachment {

  name: string;

  path: string;

  size: number;

}


export interface TicketHistoryEvent {
  type: 'created' | 'assigned' | 'unassigned' | 'status_changed' | 'updated';
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
}

export interface CreateTicketPayload {

  customerId: string;

  customerName: string;

  branchId: string;

  branchName: string;

  subject: string;

  category: string;

  reportedBy?: string;

  contactEmail?: string;

  contactPhone?: string;

  assetReference?: string;

  priority: TicketPriority;

  description: string;

}


export interface UpdateTicketPayload {

  subject?: string;

  category?: string;

  priority?: TicketPriority;

  status?: TicketStatus;

  description?: string;

  assignedEmployeeId?: string;

}


export interface Ticket {

  _id: string;

  ticketNumber: string;

  customerId: string;

  customerName: string;

  branchId: string;

  branchName: string;

  subject: string;

  category: string;

  reportedBy?: string;

  contactEmail?: string;

  contactPhone?: string;

  assetReference?: string;

  priority: TicketPriority;

  status: TicketStatus;

  description: string;

  assignedTo: string;

  assignedRole: string;

  assignedEmployeeId?: string;

  history?: TicketHistoryEvent[];

  attachments: TicketAttachment[];

  createdAt: string;

  updatedAt: string;

}


export interface TicketListResponse {

  success: boolean;

  count: number;

  tickets: Ticket[];

}


export interface TicketResponse {

  success: boolean;

  message?: string;

  ticket: Ticket;

}


export interface DeleteTicketResponse {

  success: boolean;

  message: string;

}


@Injectable({
  providedIn: 'root'
})
export class TicketService {

  private readonly apiUrl = `${API_BASE_URL}/tickets`;


  constructor(
    private http: HttpClient
  ) {}


  createTicket(
    payload: CreateTicketPayload
  ): Observable<TicketResponse> {

    return this.http.post<TicketResponse>(
      this.apiUrl,
      payload,
      { withCredentials: true }
    );

  }


  getTickets(
    customerId?: string,
    branchId?: string,
    status?: string,
    priority?: string
  ): Observable<TicketListResponse> {

    let params =
      new HttpParams();


    if (customerId) {

      params =
        params.set(
          'customerId',
          customerId
        );

    }


    if (branchId) {

      params =
        params.set(
          'branchId',
          branchId
        );

    }


    if (status) {

      params =
        params.set(
          'status',
          status
        );

    }


    if (priority) {

      params =
        params.set(
          'priority',
          priority
        );

    }


    return this.http.get<TicketListResponse>(
      this.apiUrl,
      {
        params,
        withCredentials: true
      }
    );

  }


  getTicketById(
    id: string
  ): Observable<TicketResponse> {

    return this.http.get<TicketResponse>(
      `${this.apiUrl}/${id}`,
      { withCredentials: true }
    );

  }


  updateTicket(
    id: string,
    payload: UpdateTicketPayload
  ): Observable<TicketResponse> {

    return this.http.put<TicketResponse>(
      `${this.apiUrl}/${id}`,
      payload,
      { withCredentials: true }
    );

  }


  deleteTicket(
    id: string
  ): Observable<DeleteTicketResponse> {

    return this.http.delete<DeleteTicketResponse>(
      `${this.apiUrl}/${id}`,
      { withCredentials: true }
    );

  }

}
