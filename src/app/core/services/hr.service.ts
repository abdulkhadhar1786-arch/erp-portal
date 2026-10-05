import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api-base';
import { Observable } from 'rxjs';

export type HrStatus = 'Active' | 'Inactive';

export interface OfficeBranchRecord {
  _id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  status: HrStatus;
  employeeCount: number;
}

export interface OfficeBranchPayload {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  status: HrStatus;
}

export interface EmployeeRecord {
  _id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  officeBranchId: string;
  officeBranchName: string;
  officeBranchCode: string;
  hireDate: string | null;
  status: HrStatus;
  canLogin: boolean;
}

export interface EmployeePayload {
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  department: string;
  officeBranchId: string;
  hireDate: string;
  status: HrStatus;
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class HrService {
  private readonly apiUrl = `${API_BASE_URL}/hr`;
  private readonly options = { withCredentials: true } as const;

  constructor(private http: HttpClient) {}

  getOfficeBranches(): Observable<{ success: boolean; count: number; branchOffices: OfficeBranchRecord[] }> {
    return this.http.get<{ success: boolean; count: number; branchOffices: OfficeBranchRecord[] }>(
      `${this.apiUrl}/branch-offices`, this.options
    );
  }

  getOfficeBranch(id: string): Observable<{ success: boolean; officeBranch: OfficeBranchRecord }> {
    return this.http.get<{ success: boolean; officeBranch: OfficeBranchRecord }>(
      `${this.apiUrl}/branch-offices/${encodeURIComponent(id)}`, this.options
    );
  }

  createOfficeBranch(payload: OfficeBranchPayload): Observable<{ success: boolean; officeBranch: OfficeBranchRecord }> {
    return this.http.post<{ success: boolean; officeBranch: OfficeBranchRecord }>(
      `${this.apiUrl}/branch-offices`, payload, this.options
    );
  }

  updateOfficeBranch(id: string, payload: OfficeBranchPayload): Observable<{ success: boolean; officeBranch: OfficeBranchRecord }> {
    return this.http.put<{ success: boolean; officeBranch: OfficeBranchRecord }>(
      `${this.apiUrl}/branch-offices/${encodeURIComponent(id)}`, payload, this.options
    );
  }

  getEmployees(): Observable<{ success: boolean; count: number; employees: EmployeeRecord[] }> {
    return this.http.get<{ success: boolean; count: number; employees: EmployeeRecord[] }>(
      `${this.apiUrl}/employees`, this.options
    );
  }

  getEmployee(id: string): Observable<{ success: boolean; employee: EmployeeRecord }> {
    return this.http.get<{ success: boolean; employee: EmployeeRecord }>(
      `${this.apiUrl}/employees/${encodeURIComponent(id)}`, this.options
    );
  }

  createEmployee(payload: EmployeePayload): Observable<{ success: boolean; employee: EmployeeRecord }> {
    return this.http.post<{ success: boolean; employee: EmployeeRecord }>(
      `${this.apiUrl}/employees`, payload, this.options
    );
  }

  updateEmployee(id: string, payload: EmployeePayload): Observable<{ success: boolean; employee: EmployeeRecord }> {
    return this.http.put<{ success: boolean; employee: EmployeeRecord }>(
      `${this.apiUrl}/employees/${encodeURIComponent(id)}`, payload, this.options
    );
  }
}
