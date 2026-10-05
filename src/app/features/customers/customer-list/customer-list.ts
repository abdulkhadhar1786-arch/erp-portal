import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomerService, CustomerStatus, CustomerSummary } from '../../../core/services/customer.service';

type CustomerSort = 'name' | 'code' | 'location' | 'branches' | 'tickets' | 'credit';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.css'
})
export class CustomerList implements OnInit {
  searchText = '';
  statusFilter: CustomerStatus | '' = '';
  industryFilter = '';
  typeFilter = '';
  sortBy: CustomerSort = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  page = 1;
  pageSize = 12;
  customers: CustomerSummary[] = [];
  loading = true;
  errorMessage = '';

  constructor(private customerService: CustomerService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.customerService.getCustomers().subscribe({
      next: response => {
        this.customers = response.customers;
        this.page = 1;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load customers.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get activeCount(): number {
    return this.customers.filter(customer => customer.status === 'Active').length;
  }

  get totalBranches(): number {
    return this.customers.reduce((total, customer) => total + (customer.branchCount || 0), 0);
  }

  get totalOpenTickets(): number {
    return this.customers.reduce((total, customer) => total + (customer.openTickets || 0), 0);
  }

  get industries(): string[] {
    return [...new Set(this.customers.map(customer => customer.industry?.trim()).filter((value): value is string => !!value))]
      .sort((a, b) => a.localeCompare(b));
  }

  get customerTypes(): string[] {
    return [...new Set(this.customers.map(customer => customer.customerType?.trim()).filter((value): value is string => !!value))]
      .sort((a, b) => a.localeCompare(b));
  }

  get filteredCustomers(): CustomerSummary[] {
    const search = this.searchText.trim().toLocaleLowerCase();
    const filtered = this.customers.filter(customer => {
      const location = this.locationFor(customer);
      const searchable = [
        customer.name, customer.tradeName, customer.code, customer.email, customer.phone,
        customer.contactPerson, customer.secondaryContactName, customer.secondaryContactEmail,
        customer.industry, customer.customerType, customer.gstin, customer.pan, location,
        customer.accountManager, customer.assignedBranch
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return (!search || searchable.includes(search)) &&
        (!this.statusFilter || customer.status === this.statusFilter) &&
        (!this.industryFilter || customer.industry === this.industryFilter) &&
        (!this.typeFilter || customer.customerType === this.typeFilter);
    });

    return filtered.sort((a, b) => this.compareCustomers(a, b) * (this.sortDirection === 'asc' ? 1 : -1));
  }

  get pageCustomers(): CustomerSummary[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredCustomers.slice(start, start + this.pageSize);
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filteredCustomers.length / this.pageSize));
  }

  get resultStart(): number {
    return this.filteredCustomers.length ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get resultEnd(): number {
    return Math.min(this.page * this.pageSize, this.filteredCustomers.length);
  }

  get hasFilters(): boolean {
    return !!(this.searchText.trim() || this.statusFilter || this.industryFilter || this.typeFilter);
  }

  countByStatus(status: CustomerStatus | ''): number {
    return status ? this.customers.filter(customer => customer.status === status).length : this.customers.length;
  }

  statusClass(status: CustomerStatus): string {
    return {
      Active: 'status-active',
      'On Hold': 'status-hold',
      Blacklisted: 'status-blocked',
      Inactive: 'status-inactive'
    }[status];
  }

  locationFor(customer: CustomerSummary): string {
    return [customer.billingAddress?.city || customer.city, customer.billingAddress?.state]
      .filter(Boolean).join(', ') || 'Location not set';
  }

  resetFilters(): void {
    this.searchText = '';
    this.statusFilter = '';
    this.industryFilter = '';
    this.typeFilter = '';
    this.page = 1;
  }

  setStatus(status: CustomerStatus | ''): void {
    this.statusFilter = status;
    this.page = 1;
  }

  setSort(sort: CustomerSort): void {
    if (this.sortBy === sort) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = sort;
      this.sortDirection = sort === 'tickets' || sort === 'branches' || sort === 'credit' ? 'desc' : 'asc';
    }
  }

  changePage(page: number): void {
    this.page = Math.min(Math.max(page, 1), this.pageCount);
  }

  exportCsv(): void {
    const headings = ['Customer code', 'Legal name', 'Trade name', 'Status', 'Type', 'Industry', 'Primary contact', 'Email', 'Phone', 'Location', 'Branches', 'Open tickets', 'Credit limit', 'Currency'];
    const rows = this.filteredCustomers.map(customer => [
      customer.code, customer.name, customer.tradeName ?? '', customer.status, customer.customerType ?? '', customer.industry ?? '',
      customer.contactPerson ?? '', customer.email, customer.phone, this.locationFor(customer), customer.branchCount,
      customer.openTickets, customer.creditLimit ?? 0, customer.currency ?? 'INR'
    ]);
    const csv = [headings, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `customer-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private compareCustomers(a: CustomerSummary, b: CustomerSummary): number {
    switch (this.sortBy) {
      case 'code': return a.code.localeCompare(b.code, undefined, { numeric: true });
      case 'location': return this.locationFor(a).localeCompare(this.locationFor(b));
      case 'branches': return (a.branchCount || 0) - (b.branchCount || 0);
      case 'tickets': return (a.openTickets || 0) - (b.openTickets || 0);
      case 'credit': return (a.creditLimit || 0) - (b.creditLimit || 0);
      default: return a.name.localeCompare(b.name);
    }
  }
}
