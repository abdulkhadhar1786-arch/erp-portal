import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HrService, OfficeBranchPayload, OfficeBranchRecord } from '../../../core/services/hr.service';

@Component({
  selector: 'app-hr-branch-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './branch-form.html'
})
export class HrBranchForm implements OnInit {
  id = '';
  loading = false;
  saving = false;
  submitted = false;
  errorMessage = '';
  officeCode = '';
  office: OfficeBranchPayload = { name: '', email: '', phone: '', address: '', city: '', state: '', status: 'Active' };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: HrService,
    private cdr: ChangeDetectorRef
  ) {}

  get editing(): boolean { return !!this.id; }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.id) return;
    this.loading = true;
    this.service.getOfficeBranch(this.id).subscribe({
      next: ({ officeBranch }) => {
        this.office = {
          name: officeBranch.name, email: officeBranch.email, phone: officeBranch.phone,
          address: officeBranch.address, city: officeBranch.city, state: officeBranch.state,
          status: officeBranch.status
        };
        this.officeCode = officeBranch.code;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load branch office.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (!this.office.name.trim() || (this.office.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.office.email))) return;
    const payload: OfficeBranchPayload = {
      ...this.office,
      name: this.office.name.trim(), email: this.office.email.trim(), phone: this.office.phone.trim(),
      address: this.office.address.trim(), city: this.office.city.trim(), state: this.office.state.trim()
    };
    this.saving = true;
    const request = this.editing
      ? this.service.updateOfficeBranch(this.id, payload)
      : this.service.createOfficeBranch(payload);
    request.subscribe({
      next: ({ officeBranch }: { officeBranch: OfficeBranchRecord }) => {
        this.saving = false;
        this.cdr.markForCheck();
        void this.router.navigate(['/admin/hr/branches']);
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to save branch office.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
