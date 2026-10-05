import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BranchRecord, CustomerService, CustomerSummary } from '../../../core/services/customer.service';
import { CreateTicketPayload, TicketPriority, TicketService } from '../../../core/services/ticket.service';

@Component({
  selector: 'app-ticket-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ticket-form.html'
})
export class TicketForm implements OnInit {
  submitted = false;
  saving = false;
  loadingCustomers = true;
  loadingBranches = false;
  private branchRequestId = 0;
  errorMessage = '';
  customers: CustomerSummary[] = [];
  branches: BranchRecord[] = [];
  categories = ['Hardware', 'Software', 'Network', 'Printer', 'CCTV', 'Biometric', 'Internet', 'Email', 'Application', 'Other'];
  ticket = {
    customerId: '', branchId: '', subject: '', category: '',
    priority: 'Medium' as TicketPriority, description: '', reportedBy: '',
    contactEmail: '', contactPhone: '', assetReference: ''
  };

  constructor(
    private ticketService: TicketService,
    private customerService: CustomerService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe({
      next: response => {
        this.customers = response.customers.filter(customer => customer.status === 'Active');
        this.loadingCustomers = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load customers.';
        this.loadingCustomers = false;
        this.cdr.markForCheck();
      }
    });
  }

  get filteredBranches(): BranchRecord[] {
    return this.branches.filter(branch => branch.status === 'Active');
  }

  get invalidContactEmail(): boolean {
    const email = this.ticket.contactEmail.trim();
    return email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  onCustomerChange(): void {
    const requestId = ++this.branchRequestId;
    this.ticket.branchId = '';
    this.branches = [];
    this.errorMessage = '';
    if (!this.ticket.customerId) {
      this.loadingBranches = false;
      this.cdr.markForCheck();
      return;
    }
    this.loadingBranches = true;
    this.customerService.getBranches(this.ticket.customerId).subscribe({
      next: response => {
        if (requestId !== this.branchRequestId) return;
        this.branches = response.branches;
        this.loadingBranches = false;
        this.cdr.markForCheck();
      },
      error: error => {
        if (requestId !== this.branchRequestId) return;
        this.errorMessage = error?.error?.message ?? 'Unable to load branches for this customer.';
        this.loadingBranches = false;
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (
      this.saving || this.loadingCustomers || this.loadingBranches ||
      !this.ticket.customerId || !this.ticket.branchId ||
      !this.ticket.subject.trim() || this.ticket.subject.trim().length > 160 ||
      !this.ticket.category || this.ticket.category.length > 100 ||
      !this.ticket.description.trim() || this.ticket.description.trim().length > 5000 ||
      this.invalidContactEmail
    ) return;

    const customer = this.customers.find(item => item._id === this.ticket.customerId);
    const branch = this.filteredBranches.find(item => item._id === this.ticket.branchId);
    if (!customer || !branch) {
      this.errorMessage = 'Choose an active customer and one of its active branches.';
      return;
    }

    const payload: CreateTicketPayload = {
      customerId: customer._id,
      customerName: customer.name,
      branchId: branch._id,
      branchName: branch.name,
      subject: this.ticket.subject.trim(),
      category: this.ticket.category,
      priority: this.ticket.priority,
      description: this.ticket.description.trim(),
      reportedBy: this.ticket.reportedBy.trim(),
      contactEmail: this.ticket.contactEmail.trim(),
      contactPhone: this.ticket.contactPhone.trim(),
      assetReference: this.ticket.assetReference.trim()
    };
    this.saving = true;
    this.ticketService.createTicket(payload).subscribe({
      next: () => {
        this.saving = false;
        this.cdr.markForCheck();
        void this.router.navigate(['/admin/service/tickets']);
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to create ticket.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
