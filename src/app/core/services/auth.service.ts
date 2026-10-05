import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api-base';

export interface AuthResponse {
  success: boolean;
  username: string;
  role: 'admin' | 'customer_admin' | 'branch' | 'engineer';
  customerId?: string;
  branchId?: string;
}

export interface ApiHealth {
  success: boolean;
  service: 'available';
  database: 'connected' | 'disconnected';
  checkedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${API_BASE_URL}/auth`;

  constructor(private http: HttpClient) {}

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/login`,
      { username, password },
      { withCredentials: true }
    );
  }

  getSession(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(
      `${this.apiUrl}/session`,
      { withCredentials: true }
    );
  }

  getHealth(): Observable<ApiHealth> {
    return this.http.get<ApiHealth>(
      `${API_BASE_URL}/health`,
      { withCredentials: true }
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/logout`,
      {},
      { withCredentials: true }
    );
  }
}