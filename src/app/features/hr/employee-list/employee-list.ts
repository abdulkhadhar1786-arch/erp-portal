import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EmployeeRecord, HrService, OfficeBranchRecord } from '../../../core/services/hr.service';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './employee-list.html'
})
export class EmployeeList implements OnInit {
  employees: EmployeeRecord[] = [];
  offices: OfficeBranchRecord[] = [];
  searchText = '';
  statusFilter = '';
  officeFilter = '';
  loading = true;
  savingId = '';
  errorMessage = '';

  constructor(private service: HrService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.service.getEmployees().subscribe({
      next: response => {
        this.employees = response.employees;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load employees.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
    this.service.getOfficeBranches().subscribe({
      next: response => {
        this.offices = response.branchOffices;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      }
    });
  }

  get activeCount(): number {
    return this.employees.filter(employee => employee.status === 'Active').length;
  }

  get filtered(): EmployeeRecord[] {
    const query = this.searchText.trim().toLowerCase();
    return this.employees.filter(employee => {
      const matchesText = !query || [employee.code, employee.name, employee.email, employee.phone, employee.jobTitle, employee.department, employee.officeBranchName]
        .some(value => value.toLowerCase().includes(query));
      const matchesStatus = !this.statusFilter || employee.status === this.statusFilter;
      const matchesOffice = !this.officeFilter || employee.officeBranchId === this.officeFilter;
      return matchesText && matchesStatus && matchesOffice;
    });
  }

  toggleStatus(employee: EmployeeRecord): void {
    if (this.savingId) return;
    this.savingId = employee._id;
    this.service.updateEmployee(employee._id, {
      name: employee.name, email: employee.email, phone: employee.phone,
      jobTitle: employee.jobTitle, department: employee.department,
      officeBranchId: employee.officeBranchId,
      hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : '',
      status: employee.status === 'Active' ? 'Inactive' : 'Active'
    }).subscribe({
      next: ({ employee: updated }) => {
        Object.assign(employee, updated);
        this.savingId = '';
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to update employee status.';
        this.savingId = '';
        this.cdr.markForCheck();
      }
    });
  }
}
