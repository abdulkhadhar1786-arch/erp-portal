import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BranchRecord, CustomerDetails as CustomerRecord, CustomerService, CustomerStatus } from '../../../core/services/customer.service';

type CustomerDetailsTab = 'company' | 'branches' | 'contacts' | 'account';

interface CustomerFieldRow {
  label: string;
  value: string;
  href?: string;
}

interface CustomerContactRow {
  id: string;
  name: string;
  account: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  branchId?: string;
}

@Component({
  selector: 'app-customer-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './customer-details.html',
  styleUrl: './customer-details.css'
})
export class CustomerDetails implements OnInit {
  readonly tabs: { id: CustomerDetailsTab; label: string }[] = [
    { id: 'company', label: 'Company' },
    { id: 'branches', label: 'Branches' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'account', label: 'Account' }
  ];
  activeTab: CustomerDetailsTab = 'company';
  customerId = '';
  customer: CustomerRecord | null = null;
  branches: BranchRecord[] = [];
  loading = true;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private service: CustomerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadCustomer();
  }

  loadCustomer(): void {
    this.loading = true;
    this.errorMessage = '';
    this.service.getCustomer(this.customerId).subscribe({
      next: ({ customer }) => {
        this.customer = customer;
        this.branches = customer.branches;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load customer details.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get totalOpenTickets(): number {
    return this.branches.reduce((total, branch) => total + (branch.openTickets ?? 0), 0);
  }

  get activeBranches(): number {
    return this.branches.filter(branch => branch.status === 'Active').length;
  }

  get maskedBankAccount(): string {
    const accountNumber = this.customer?.bankAccountNumber ?? '';
    return accountNumber ? `Ending in ${accountNumber.slice(-4)}` : 'Not provided';
  }

  get customerInitials(): string {
    return (this.customer?.name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  get companyFields(): CustomerFieldRow[] {
    const customer = this.customer;
    if (!customer) return [];

    return [
      { label: 'Customer code', value: customer.code },
      { label: 'Company name', value: customer.name },
      { label: 'Display name', value: customer.tradeName || 'Not provided' },
      { label: 'Type of company', value: customer.customerType || 'Not provided' },
      { label: 'Industry', value: customer.industry || 'Not provided' },
      { label: 'Website', value: customer.website || 'Not provided', href: customer.website || undefined },
      { label: 'Primary contact', value: customer.contactPerson || 'Not provided' },
      { label: 'Designation', value: customer.designation || 'Not provided' },
      { label: 'Department', value: customer.department || 'Not provided' },
      { label: 'Email', value: customer.email || 'Not provided', href: customer.email ? `mailto:${customer.email}` : undefined },
      { label: 'Mobile number', value: customer.phone || 'Not provided', href: customer.phone ? `tel:${customer.phone}` : undefined },
      { label: 'Alternate contact', value: customer.secondaryContactName || 'Not provided' },
      { label: 'Alternate designation', value: customer.secondaryContactDesignation || 'Not provided' },
      { label: 'Alternate email', value: customer.secondaryContactEmail || 'Not provided', href: customer.secondaryContactEmail ? `mailto:${customer.secondaryContactEmail}` : undefined },
      { label: 'Alternate mobile', value: customer.secondaryContactPhone || 'Not provided', href: customer.secondaryContactPhone ? `tel:${customer.secondaryContactPhone}` : undefined },
      { label: 'Billing address', value: this.billingAddressLabel },
      { label: 'Shipping address', value: this.shippingAddressLabel },
      { label: 'GST number', value: customer.gstin || 'Not provided' },
      { label: 'GST registration type', value: customer.gstRegistrationType || 'Not provided' },
      { label: 'Place of supply', value: customer.placeOfSupplyCode || 'Not provided' },
      { label: 'PAN number', value: customer.pan || 'Not provided' },
      { label: 'Managed by', value: customer.accountManager || 'Not assigned' },
      { label: 'Assigned service branch', value: customer.assignedBranch || 'Not assigned' },
      { label: 'Account status', value: customer.status }
    ];
  }

  get contactRows(): CustomerContactRow[] {
    const customer = this.customer;
    if (!customer) return [];

    const contacts: CustomerContactRow[] = [{
      id: 'company-primary',
      name: customer.contactPerson || 'Primary contact not set',
      account: customer.name,
      role: customer.designation || 'Primary contact',
      department: customer.department || 'Not provided',
      email: customer.email || '',
      phone: customer.phone || ''
    }];

    if (customer.secondaryContactName || customer.secondaryContactEmail || customer.secondaryContactPhone) {
      contacts.push({
        id: 'company-secondary',
        name: customer.secondaryContactName || 'Alternate contact',
        account: customer.name,
        role: customer.secondaryContactDesignation || 'Alternate contact',
        department: 'Not provided',
        email: customer.secondaryContactEmail || '',
        phone: customer.secondaryContactPhone || ''
      });
    }

    for (const branch of this.branches) {
      if (!branch.email && !branch.phone) continue;
      contacts.push({
        id: `branch-${branch._id}`,
        name: branch.name,
        account: 'Branch service contact',
        role: 'Branch contact',
        department: 'Service',
        email: branch.email,
        phone: branch.phone,
        branchId: branch._id
      });
    }
    return contacts;
  }

  customerStatusClass(status: CustomerStatus): string {
    return `detail-${status.toLowerCase().replaceAll(' ', '-')}`;
  }

  branchLocation(branch: BranchRecord): string {
    return [branch.city, branch.state].filter(Boolean).join(', ') || 'Location not set';
  }

  get billingAddressLabel(): string {
    const address = this.customer?.billingAddress;
    return [address?.building, address?.street, address?.area, address?.city || this.customer?.city,
      address?.state, address?.pincode, address?.country].filter(Boolean).join(', ') || 'Billing address not provided';
  }

  get shippingAddressLabel(): string {
    const address = this.customer?.shippingAddress;
    return [address?.building, address?.street, address?.area, address?.city,
      address?.state, address?.pincode, address?.country].filter(Boolean).join(', ') || 'Shipping address not provided';
  }

  get contractExpiryLabel(): string {
    const expiry = this.customer?.contractExpiryDate;
    if (!expiry) return 'No expiry date recorded';
    const end = new Date(`${expiry.slice(0, 10)}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return `Expired ${Math.abs(days)} days ago`;
    if (days === 0) return 'Expires today';
    if (days <= 60) return `Renewal due in ${days} days`;
    return `Current · ${days} days remaining`;
  }

  get bankAccountSummary(): string {
    const account = this.customer?.bankAccountNumber || '';
    return account ? `Ending in ${account.slice(-4)}` : 'Not provided';
  }

  setTab(tab: CustomerDetailsTab): void {
    this.activeTab = tab;
  }
}
