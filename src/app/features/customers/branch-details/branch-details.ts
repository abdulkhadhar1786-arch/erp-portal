import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BranchRecord, CustomerService } from '../../../core/services/customer.service';

@Component({
  selector: 'app-branch-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './branch-details.html',
  styleUrl: './branch-details.css'
})
export class BranchDetails implements OnInit {
  customerId = '';
  branchId = '';
  branch: BranchRecord | null = null;
  loading = true;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private service: CustomerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('customerId') ?? '';
    this.branchId = this.route.snapshot.paramMap.get('branchId') ?? '';
    this.loadBranch();
  }

  loadBranch(): void {
    this.loading = true;
    this.errorMessage = '';
    this.service.getBranch(this.customerId, this.branchId).subscribe({
      next: ({ branch }) => {
        this.branch = branch;
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
}
