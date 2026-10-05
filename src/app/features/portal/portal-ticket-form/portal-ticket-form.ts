import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PortalBranch, PortalRole, PortalService, PortalTicketPayload } from '../../../core/services/portal.service';

@Component({
  selector: 'app-portal-ticket-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './portal-ticket-form.html'
})
export class PortalTicketForm implements OnInit {
  readonly role: PortalRole;
  readonly priorities: PortalTicketPayload['priority'][] = ['Low', 'Medium', 'High', 'Critical'];
  readonly categories = ['Hardware', 'Software', 'Network', 'Printer', 'CCTV', 'Biometric', 'Internet', 'Email', 'Application', 'Other'];
  branches: PortalBranch[] = [];
  branchName = '';
  branchId = '';
  subject = '';
  category = '';
  priority: PortalTicketPayload['priority'] = 'Medium';
  description = '';
  reportedBy = '';
  contactEmail = '';
  contactPhone = '';
  assetReference = '';
  loading = true;
  saving = false;
  submitted = false;
  errorMessage = '';

  constructor(
    route: ActivatedRoute,
    private portal: PortalService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.role = route.snapshot.data['portalRole'] as PortalRole;
  }

  get basePath(): string { return this.role === 'branch' ? '/portal/branch' : '/portal/customer'; }

  get activeBranches(): PortalBranch[] {
    return this.branches.filter(branch => branch.status === 'Active');
  }

  ngOnInit(): void {
    this.loadBranchInformation();
  }

  loadBranchInformation(): void {
    this.loading = true;
    this.errorMessage = '';
    this.portal.getDashboard(this.role).subscribe({
      next: dashboard => {
        this.branches = dashboard.branches ?? [];
        if (this.role === 'branch') this.branchId = dashboard.account._id;
        else this.branchId = this.activeBranches[0]?._id ?? '';
        this.branchName = this.role === 'branch' ? dashboard.account.name ?? '' : '';
        this.reportedBy = dashboard.account.contactPerson ?? '';
        this.contactEmail = dashboard.account.email ?? '';
        this.contactPhone = dashboard.account.phone ?? '';
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load branch information.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  submit(): void {
    this.submitted = true;
    if (
      this.saving || !this.branchId || !this.subject.trim() || !this.category.trim() ||
      !this.description.trim() || this.invalidContactEmail
    ) return;
    this.saving = true;
    this.errorMessage = '';
    this.portal.createTicket(this.role, {
      branchId: this.branchId,
      subject: this.subject.trim(),
      category: this.category.trim(),
      priority: this.priority,
      description: this.description.trim(),
      reportedBy: this.reportedBy.trim(),
      contactEmail: this.contactEmail.trim(),
      contactPhone: this.contactPhone.trim(),
      assetReference: this.assetReference.trim()
    }).subscribe({
      next: ({ ticket }) => {
        this.saving = false;
        this.cdr.markForCheck();
        void this.router.navigate([this.basePath, 'tickets', ticket._id]);
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to create ticket.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  get invalidContactEmail(): boolean {
    const email = this.contactEmail.trim();
    return email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
