import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BranchPayload, BranchRecord, BranchStatus, CustomerService } from '../../../core/services/customer.service';

@Component({
  selector: 'app-branch-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './branch-form.html',
  styleUrl: './branch-form.css'
})
export class BranchForm implements OnInit {
  customerId = '';
  branchId = '';
  submitted = false;
  loading = false;
  saving = false;
  errorMessage = '';
  branch = {
    name: '', phone: '', email: '', address: '', city: '', state: '',
    pincode: '', username: '', password: '', status: 'Active' as BranchStatus
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: CustomerService,
    private cdr: ChangeDetectorRef
  ) {}

  get editing(): boolean {
    return !!this.branchId;
  }

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('customerId') ?? '';
    this.branchId = this.route.snapshot.paramMap.get('branchId') ?? '';
    if (!this.branchId) return;
    this.loading = true;
    this.service.getBranch(this.customerId, this.branchId).subscribe({
      next: ({ branch }) => {
        this.branch = {
          name: branch.name,
          phone: branch.phone,
          email: branch.email,
          address: branch.address,
          city: branch.city,
          state: branch.state,
          pincode: branch.pincode,
          username: branch.username,
          password: '',
          status: branch.status
        };
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load branch.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (
      !this.branch.name.trim() || !this.branch.username.trim() ||
      (!this.editing && this.branch.password.length < 12) ||
      (this.branch.password.length > 0 && this.branch.password.length < 12) ||
      (this.branch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.branch.email))
    ) return;

    const payload: BranchPayload = {
      name: this.branch.name.trim(),
      phone: this.branch.phone.trim(),
      email: this.branch.email.trim(),
      address: this.branch.address.trim(),
      city: this.branch.city.trim(),
      state: this.branch.state.trim(),
      pincode: this.branch.pincode.trim(),
      username: this.branch.username.trim(),
      status: this.branch.status,
      ...(this.branch.password ? { password: this.branch.password } : {})
    };
    this.saving = true;
    const request = this.editing
      ? this.service.updateBranch(this.customerId, this.branchId, payload)
      : this.service.createBranch(this.customerId, payload);
    request.subscribe({
      next: ({ branch }: { branch: BranchRecord }) => {
        this.saving = false;
        this.cdr.markForCheck();
        void this.router.navigate(['/admin/customers', this.customerId, 'branches', branch._id]);
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to save branch.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
