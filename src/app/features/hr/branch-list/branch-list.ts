import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HrService, OfficeBranchRecord } from '../../../core/services/hr.service';

@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './branch-list.html'
})
export class BranchList implements OnInit {
  branchOffices: OfficeBranchRecord[] = [];
  searchText = '';
  statusFilter = '';
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
    this.service.getOfficeBranches().subscribe({
      next: response => {
        this.branchOffices = response.branchOffices;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load branch offices.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get activeCount(): number {
    return this.branchOffices.filter(office => office.status === 'Active').length;
  }

  get employeeTotal(): number {
    return this.branchOffices.reduce((total, office) => total + office.employeeCount, 0);
  }

  get filtered(): OfficeBranchRecord[] {
    const query = this.searchText.trim().toLowerCase();
    return this.branchOffices.filter(office => {
      const matchesQuery = !query || [office.code, office.name, office.city, office.state, office.email]
        .some(value => value.toLowerCase().includes(query));
      return matchesQuery && (!this.statusFilter || office.status === this.statusFilter);
    });
  }

  toggleStatus(office: OfficeBranchRecord): void {
    if (this.savingId) return;
    this.savingId = office._id;
    this.service.updateOfficeBranch(office._id, {
      name: office.name, email: office.email, phone: office.phone,
      address: office.address, city: office.city, state: office.state,
      status: office.status === 'Active' ? 'Inactive' : 'Active'
    }).subscribe({
      next: ({ officeBranch }) => {
        Object.assign(office, officeBranch);
        this.savingId = '';
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to update branch office status.';
        this.savingId = '';
        this.cdr.markForCheck();
      }
    });
  }
}
