import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerAddress, CustomerPayload, CustomerService, CustomerStatus } from '../../../core/services/customer.service';

const blankAddress = (): CustomerAddress => ({ building: '', street: '', area: '', city: '', state: '', country: 'India', pincode: '' });

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-form.html',
  styleUrl: './customer-form.css'
})
export class CustomerForm implements OnInit {
  customerId = '';
  loading = false;
  saving = false;
  submitted = false;
  errorMessage = '';
  readonly customerTypes = ['Individual', 'Private Ltd', 'Partnership', 'Public Ltd', 'Proprietorship'];
  readonly gstTypes = ['Registered Regular', 'Composition', 'SEZ Unit/Developer', 'Unregistered', 'Overseas', 'Deemed Export'];
  readonly paymentTerms = ['Immediate', 'Net 15', 'Net 30', 'Net 60', 'Advance'];
  readonly paymentMethods = ['NEFT/RTGS', 'UPI', 'Cheque', 'PDC'];
  readonly departments = ['Accounts', 'Purchase', 'Support', 'Field Operations'];
  customer: CustomerPayload = {
    name: '', tradeName: '', customerType: 'Private Ltd', industry: '', website: '',
    contactPerson: '', designation: '', phone: '', email: '', secondaryContactName: '', secondaryContactDesignation: '',
    secondaryContactPhone: '', secondaryContactEmail: '', department: '', billingAddress: blankAddress(), shippingAddress: blankAddress(),
    branchOfficeName: '', gstin: '', gstRegistrationType: 'Unregistered', placeOfSupplyCode: '', pan: '', tan: '',
    udyamNumber: '', lutNumber: '', iecCode: '', paymentTerms: 'Immediate', creditDays: 0, creditLimit: 0,
    currency: 'INR', discountPercentage: 0, priceListTier: '', preferredPaymentMethod: 'NEFT/RTGS',
    bankAccountHolderName: '', bankName: '', bankAccountNumber: '', bankIfsc: '', bankBranchName: '',
    accountManager: '', assignedBranch: '', contractDetails: '', contractRenewalDate: '', contractExpiryDate: '',
    internalNotes: '', address: '', city: '', status: 'Active', portalUsername: '', portalPassword: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: CustomerService,
    private cdr: ChangeDetectorRef
  ) {}

  get editing(): boolean {
    return !!this.customerId;
  }

  get validPortalUsername(): boolean {
    const username = (this.customer.portalUsername ?? '').trim();
    const password = this.customer.portalPassword ?? '';
    if (!username && !password) return true;
    if (!/^[a-z0-9._-]{3,80}$/i.test(username)) return false;
    return this.editing ? !password || password.length >= 12 : password.length >= 12;
  }

  get invalidEmail(): boolean {
    return (!!this.customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.customer.email.trim())) ||
      (!!this.customer.secondaryContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.customer.secondaryContactEmail.trim()));
  }

  get sameAsBillingAddress(): boolean {
    return JSON.stringify(this.customer.billingAddress) === JSON.stringify(this.customer.shippingAddress);
  }

  copyBillingToShipping(enabled: boolean): void {
    if (enabled && this.customer.billingAddress) this.customer.shippingAddress = { ...this.customer.billingAddress };
  }

  get invalidStatutoryDetails(): boolean {
    const value = (field: keyof CustomerPayload) => String(this.customer[field] ?? '').trim().toUpperCase();
    return (!!value('gstin') && !/^[A-Z0-9]{15}$/.test(value('gstin'))) ||
      (!!value('placeOfSupplyCode') && !/^\d{2}$/.test(value('placeOfSupplyCode'))) ||
      (!!value('pan') && !/^[A-Z]{5}\d{4}[A-Z]$/.test(value('pan'))) ||
      (!!value('tan') && !/^[A-Z]{4}\d{5}[A-Z]$/.test(value('tan'))) ||
      (!!value('udyamNumber') && !/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(value('udyamNumber'))) ||
      (!!value('iecCode') && !/^[A-Z0-9]{10}$/.test(value('iecCode'))) ||
      (!!value('bankIfsc') && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value('bankIfsc')));
  }

  get invalidWebsite(): boolean {
    const website = (this.customer.website ?? '').trim();
    if (!website) return false;
    try {
      const url = new URL(website);
      return (url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname;
    } catch {
      return true;
    }
  }

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.customerId) return;
    this.loading = true;
    this.service.getCustomer(this.customerId).subscribe({
      next: ({ customer }) => {
        this.customer = {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          contactPerson: customer.contactPerson ?? '',
          industry: customer.industry ?? '',
          website: customer.website ?? '',
          tradeName: customer.tradeName ?? '',
          customerType: customer.customerType ?? 'Private Ltd',
          designation: customer.designation ?? '',
          secondaryContactName: customer.secondaryContactName ?? '',
          secondaryContactDesignation: customer.secondaryContactDesignation ?? '',
          secondaryContactPhone: customer.secondaryContactPhone ?? '',
          secondaryContactEmail: customer.secondaryContactEmail ?? '',
          department: customer.department ?? '',
          billingAddress: customer.billingAddress ?? { ...blankAddress(), street: customer.address ?? '', city: customer.city ?? '' },
          shippingAddress: customer.shippingAddress ?? blankAddress(),
          branchOfficeName: customer.branchOfficeName ?? '',
          gstin: customer.gstin ?? '',
          gstRegistrationType: customer.gstRegistrationType ?? 'Unregistered',
          placeOfSupplyCode: customer.placeOfSupplyCode ?? '',
          pan: customer.pan ?? '', tan: customer.tan ?? '', udyamNumber: customer.udyamNumber ?? '',
          lutNumber: customer.lutNumber ?? '', iecCode: customer.iecCode ?? '',
          paymentTerms: customer.paymentTerms ?? 'Immediate', creditDays: customer.creditDays ?? 0,
          creditLimit: customer.creditLimit ?? 0, currency: customer.currency ?? 'INR',
          discountPercentage: customer.discountPercentage ?? 0, priceListTier: customer.priceListTier ?? '',
          preferredPaymentMethod: customer.preferredPaymentMethod ?? 'NEFT/RTGS',
          bankAccountHolderName: customer.bankAccountHolderName ?? '', bankName: customer.bankName ?? '',
          bankAccountNumber: customer.bankAccountNumber ?? '', bankIfsc: customer.bankIfsc ?? '', bankBranchName: customer.bankBranchName ?? '',
          accountManager: customer.accountManager ?? '', assignedBranch: customer.assignedBranch ?? '',
          contractDetails: customer.contractDetails ?? '',
          contractRenewalDate: customer.contractRenewalDate?.slice(0, 10) ?? '',
          contractExpiryDate: customer.contractExpiryDate?.slice(0, 10) ?? '',
          internalNotes: customer.internalNotes ?? '',
          address: customer.address ?? '',
          city: customer.city ?? '',
          status: customer.status,
          portalUsername: customer.portalUsername ?? '',
          portalPassword: ''
        };
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load customer.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    this.submitted = true;
    this.errorMessage = '';
    if (
      !this.customer.name.trim() ||
      this.invalidEmail || !this.validPortalUsername || this.invalidStatutoryDetails || this.invalidWebsite
    ) return;
    this.saving = true;
    const payload: CustomerPayload = {
      ...this.customer,
      name: this.customer.name.trim(),
      tradeName: (this.customer.tradeName ?? '').trim(),
      customerType: this.customer.customerType,
      email: this.customer.email.trim(),
      phone: this.customer.phone.trim(),
      contactPerson: (this.customer.contactPerson ?? '').trim(),
      industry: (this.customer.industry ?? '').trim(),
      website: (this.customer.website ?? '').trim(),
      designation: (this.customer.designation ?? '').trim(),
      secondaryContactName: (this.customer.secondaryContactName ?? '').trim(),
      secondaryContactDesignation: (this.customer.secondaryContactDesignation ?? '').trim(),
      secondaryContactPhone: (this.customer.secondaryContactPhone ?? '').trim(),
      secondaryContactEmail: (this.customer.secondaryContactEmail ?? '').trim(),
      department: this.customer.department,
      billingAddress: this.customer.billingAddress,
      shippingAddress: this.customer.shippingAddress,
      branchOfficeName: (this.customer.branchOfficeName ?? '').trim(),
      gstin: (this.customer.gstin ?? '').trim().toUpperCase(),
      gstRegistrationType: this.customer.gstRegistrationType,
      placeOfSupplyCode: (this.customer.placeOfSupplyCode ?? '').trim(),
      pan: (this.customer.pan ?? '').trim().toUpperCase(),
      tan: (this.customer.tan ?? '').trim().toUpperCase(),
      udyamNumber: (this.customer.udyamNumber ?? '').trim().toUpperCase(),
      lutNumber: (this.customer.lutNumber ?? '').trim().toUpperCase(),
      iecCode: (this.customer.iecCode ?? '').trim().toUpperCase(),
      paymentTerms: this.customer.paymentTerms,
      creditDays: Number(this.customer.creditDays ?? 0),
      creditLimit: Number(this.customer.creditLimit ?? 0),
      currency: (this.customer.currency ?? 'INR').trim().toUpperCase(),
      discountPercentage: Number(this.customer.discountPercentage ?? 0),
      priceListTier: (this.customer.priceListTier ?? '').trim(),
      preferredPaymentMethod: this.customer.preferredPaymentMethod,
      bankAccountHolderName: (this.customer.bankAccountHolderName ?? '').trim(),
      bankName: (this.customer.bankName ?? '').trim(),
      bankAccountNumber: (this.customer.bankAccountNumber ?? '').trim(),
      bankIfsc: (this.customer.bankIfsc ?? '').trim().toUpperCase(),
      bankBranchName: (this.customer.bankBranchName ?? '').trim(),
      accountManager: (this.customer.accountManager ?? '').trim(),
      assignedBranch: (this.customer.assignedBranch ?? '').trim(),
      contractDetails: (this.customer.contractDetails ?? '').trim(),
      contractRenewalDate: this.customer.contractRenewalDate || null,
      contractExpiryDate: this.customer.contractExpiryDate || null,
      internalNotes: (this.customer.internalNotes ?? '').trim(),
      address: [this.customer.billingAddress?.building, this.customer.billingAddress?.street, this.customer.billingAddress?.area].filter(Boolean).join(', '),
      city: this.customer.billingAddress?.city ?? '',
      portalUsername: (this.customer.portalUsername ?? '').trim().toLowerCase(),
      portalPassword: this.customer.portalPassword ?? ''
    };
    const request = this.editing
      ? this.service.updateCustomer(this.customerId, payload)
      : this.service.createCustomer(payload);
    request.subscribe({
      next: ({ customer }) => {
        this.saving = false;
        this.cdr.markForCheck();
        void this.router.navigate(['/admin/customers', customer._id]);
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to save customer.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
