import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BranchRecord, CustomerService, CustomerSummary } from '../../../core/services/customer.service';
import { InventoryItem, InventoryService } from '../../../core/services/inventory.service';
import { QuoteLinePayload, QuotePayload, QuoteProfile, QuoteProposalDetails, QuoteStatus, SalesLineItem, SalesOrder, SalesQuote, SalesService } from '../../../core/services/sales.service';

interface QuoteLineDraft extends QuoteLinePayload {
  inventoryItemId: string;
}

interface QuoteDraft {
  customerId: string;
  branchId: string;
  discountRate: number;
  taxRate: number;
  validUntil: string;
  proposalType: string;
  warrantyType: string;
  warrantyFrom: string;
  installationBy: string;
  preventiveMaintenance: string;
  proposalDetails: QuoteProposalDetails;
  notes: string;
  termsAndConditions: string;
}

function emptyQuoteDraft(): QuoteDraft {
  return {
    customerId: '', branchId: '', discountRate: 0, taxRate: 0, validUntil: '', proposalType: 'Sales',
    warrantyType: 'Not Applicable', warrantyFrom: 'Not Applicable', installationBy: 'Not Applicable',
    preventiveMaintenance: 'Not Applicable', proposalDetails: emptyQuoteProposalDetails(), notes: '', termsAndConditions: ''
  };
}

function emptyQuoteProposalDetails(): QuoteProposalDetails {
  return {
    paymentTerms: '', paymentMilestones: '', deliveryMethod: '', deliverySchedule: '', freightCharges: 0, warrantyPeriod: '', returnPolicy: '',
    rentalStartDate: '', rentalEndDate: '', rentalBillingCycle: 'Monthly', securityDeposit: 0, rentalConditions: '',
    rentalUsageLimit: '', maintenanceResponsibility: '', damageLiability: '', returnConditions: '',
    coverageType: 'Comprehensive', responseSla: '', resolutionSla: '', serviceWindow: '', preventiveMaintenanceFrequency: '',
    preventiveVisitsPerYear: 0, contractStartDate: '',
    contractEndDate: '', exclusions: '', monoRate: 0, colorRate: 0, minimumMonoPages: 0, minimumColorPages: 0,
    mpsBillingFrequency: 'Monthly', meterReadingProcess: '',
    monoOverageRate: 0, colorOverageRate: 0, includedServices: '', serviceScope: '', supportTiers: '',
    supportAvailability: '', vendorEscalationContact: '', includedEngineerHours: 0,
    pricingBasis: 'Per hour', serviceRate: 0, escalationPath: '', operationalBoundaries: '', visitFee: 0,
    visitScope: '', visitDate: '', hourlyLaborRate: 0, laborHours: 0, includedLaborHours: 0, travelCharges: 0,
    travelDistanceKm: 0, emergencyCharges: 0
  };
}

function emptyQuoteProfile(): QuoteProfile {
  return {
    companyName: '', companyAddress: '', companyState: '', companyPhone: '', companyEmail: '', companyWebsite: '',
    companyPan: '', companyGstin: '', companyMsme: '', bankName: '', bankAccountNumber: '',
    bankBranch: '', bankIfsc: '', contactName: '', contactPhone: '', contactMobile: '',
    contactEmail: '', authorizedSignatory: '', defaultValidityDays: 30,
    defaultTerms: 'Taxes as shown above. Prices are valid until the date shown. Delivery schedule will be confirmed with the purchase order.'
  };
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyLineDraft(): QuoteLineDraft {
  return {
    inventoryItemId: '', sku: '', hsnCode: '', name: '', description: '', unit: 'unit', warranty: 'Not Applicable',
    brand: '', modelNumber: '', specifications: '', serialNumber: '', condition: '', location: '', quantity: 1, unitPrice: 0
  };
}

@Component({
  selector: 'app-quotes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './quotes.html',
  styleUrl: './quotes.css'
})
export class Quotes implements OnInit {
  @ViewChild('quotePreviewDialog') quotePreviewDialog?: ElementRef<HTMLDialogElement>;

  proposalTypes = ['Unit', 'Sales', 'Rental', 'AMC', 'MPS', 'ASP', 'Visit charge'];
  quotes: SalesQuote[] = [];
  orders: SalesOrder[] = [];
  customers: CustomerSummary[] = [];
  branches: BranchRecord[] = [];
  catalog: InventoryItem[] = [];
  profile = emptyQuoteProfile();
  loading = true;
  saving = false;
  modalOpen = false;
  editingId = '';
  statusBusyId = '';
  convertingId = '';
  selectedQuote: SalesQuote | null = null;
  expandedQuoteId = '';
  printQuote: SalesQuote | null = null;
  renewingQuote: SalesQuote | null = null;
  renewalDate = '';
  searchText = '';
  statusFilter = '';
  sortBy: 'updatedAt' | 'quoteNumber' | 'customerName' | 'validUntil' | 'total' = 'updatedAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  page = 1;
  pageSize = 10;
  pageError = '';
  formError = '';
  branchError = '';
  branchesLoading = false;
  notice = '';
  draft = emptyQuoteDraft();
  lineDraft = emptyLineDraft();
  draftLines: QuoteLineDraft[] = [];
  private prefillCustomerId = '';
  private branchRequestId = 0;
  private readonly clearPrintState = (): void => {
    this.printQuote = null;
    this.cdr.markForCheck();
  };

  constructor(
    private sales: SalesService,
    private customersApi: CustomerService,
    private inventoryApi: InventoryService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.prefillCustomerId = this.route.snapshot.queryParamMap.get('customerId') ?? '';
    this.load();
  }

  load(): void {
    this.loading = true;
    this.pageError = '';
    forkJoin({
      quotes: this.sales.getQuotes(),
      profile: this.sales.getQuoteProfile(),
      orders: this.sales.getOrders(),
      customers: this.customersApi.getCustomers(),
      inventory: this.inventoryApi.getItems()
    }).subscribe({
      next: ({ quotes, profile, orders, customers, inventory }) => {
        this.quotes = quotes.quotes ?? [];
        this.profile = { ...emptyQuoteProfile(), ...profile.profile };
        this.orders = orders.orders ?? [];
        this.customers = (customers.customers ?? []).filter(customer => customer.status === 'Active');
        this.catalog = (inventory.items ?? []).filter(item => item.status === 'Active');
        if (this.prefillCustomerId && this.customers.some(customer => customer._id === this.prefillCustomerId)) {
          this.draft.customerId = this.prefillCustomerId;
          this.loadCustomerBranches(this.prefillCustomerId);
          const validUntil = new Date();
          validUntil.setDate(validUntil.getDate() + this.profile.defaultValidityDays);
          this.draft.validUntil = localDateKey(validUntil);
          this.draft.termsAndConditions = this.profile.defaultTerms;
          this.modalOpen = true;
          this.prefillCustomerId = '';
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.pageError = error?.error?.message ?? 'Unable to load sales quotes.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get filteredQuotes(): SalesQuote[] {
    const query = this.searchText.trim().toLowerCase();
    return this.quotes.filter(quote => {
      const searchable = [
        quote.quoteNumber,
        quote.customerName,
        quote.branchName ?? '',
        quote.customerEmail,
        quote.customerPhone,
        ...quote.lineItems.flatMap(line => [line.name, line.sku])
      ];
      const matchesQuery = !query || searchable.some(value => value.toLowerCase().includes(query));
      return matchesQuery && (!this.statusFilter || quote.status === this.statusFilter);
    });
  }

  get sortedQuotes(): SalesQuote[] {
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    return [...this.filteredQuotes].sort((left, right) => {
      if (this.sortBy === 'validUntil' && left.validUntil !== right.validUntil) {
        if (!left.validUntil) return 1;
        if (!right.validUntil) return -1;
      }
      const leftValue = this.sortBy === 'total' ? left.total
        : this.sortBy === 'validUntil' ? (left.validUntil ? Date.parse(left.validUntil) : 0)
          : this.sortBy === 'updatedAt' ? Date.parse(left.updatedAt)
            : this.sortBy === 'quoteNumber' ? left.quoteNumber.toLowerCase() : left.customerName.toLowerCase();
      const rightValue = this.sortBy === 'total' ? right.total
        : this.sortBy === 'validUntil' ? (right.validUntil ? Date.parse(right.validUntil) : 0)
          : this.sortBy === 'updatedAt' ? Date.parse(right.updatedAt)
            : this.sortBy === 'quoteNumber' ? right.quoteNumber.toLowerCase() : right.customerName.toLowerCase();
      if (leftValue < rightValue) return -direction;
      if (leftValue > rightValue) return direction;
      return left.quoteNumber.localeCompare(right.quoteNumber) * direction;
    });
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.sortedQuotes.length / this.pageSize));
  }

  get currentPage(): number {
    return Math.min(this.page, this.pageCount);
  }

  get pageQuotes(): SalesQuote[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.sortedQuotes.slice(start, start + this.pageSize);
  }

  get draftCount(): number {
    return this.quotes.filter(quote => quote.status === 'Draft').length;
  }

  get awaitingCount(): number {
    return this.quotes.filter(quote => quote.status === 'Sent').length;
  }

  get acceptedValue(): number {
    return this.quotes.filter(quote => quote.status === 'Accepted')
      .reduce((total, quote) => total + quote.total, 0);
  }

  get expiredCount(): number {
    return this.quotes.filter(quote => quote.status === 'Expired' || (quote.status === 'Sent' && this.isPastDue(quote))).length;
  }

  get convertedCount(): number {
    return this.orders.length;
  }

  get subTotal(): number {
    return this.draftLines.reduce((total, line) => total + line.quantity * line.unitPrice, 0);
  }

  get taxAmount(): number {
    return this.taxableAmount * this.draft.taxRate / 100;
  }

  get discountAmount(): number {
    return this.subTotal * this.draft.discountRate / 100;
  }

  get taxableAmount(): number {
    return this.subTotal - this.discountAmount + this.additionalCharges;
  }

  get additionalCharges(): number {
    const details = this.draft.proposalDetails;
    if (this.draft.proposalType === 'Sales' || this.draft.proposalType === 'Unit') {
      return Number(details.freightCharges) || 0;
    }
    if (this.draft.proposalType === 'MPS') return this.mpsBillingCommitment;
    if (this.draft.proposalType === 'Visit charge') {
      const billableHours = Math.max(0, (Number(details.laborHours) || 0) - (Number(details.includedLaborHours) || 0));
      return (Number(details.visitFee) || 0) + (Number(details.hourlyLaborRate) || 0) * billableHours +
        (Number(details.travelCharges) || 0) + (Number(details.emergencyCharges) || 0);
    }
    return 0;
  }

  get mpsMinimumCharge(): number {
    const details = this.draft.proposalDetails;
    return (Number(details.monoRate) || 0) * (Number(details.minimumMonoPages) || 0) +
      (Number(details.colorRate) || 0) * (Number(details.minimumColorPages) || 0);
  }

  get mpsBillingPeriods(): number {
    return this.draft.proposalDetails.mpsBillingFrequency === 'Quarterly' ? 3 : 1;
  }

  get mpsBillingCommitment(): number {
    return this.mpsMinimumCharge * this.mpsBillingPeriods;
  }

  get visitBillableHours(): number {
    const details = this.draft.proposalDetails;
    return Math.max(0, (Number(details.laborHours) || 0) - (Number(details.includedLaborHours) || 0));
  }

  get quoteTotal(): number {
    return Math.round(this.taxableAmount + this.taxAmount);
  }

  openCreate(): void {
    this.editingId = '';
    this.draft = emptyQuoteDraft();
    this.loadCustomerBranches('');
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + this.profile.defaultValidityDays);
    this.draft.validUntil = localDateKey(validUntil);
    this.draft.termsAndConditions = this.profile.defaultTerms;
    this.draftLines = [];
    this.lineDraft = emptyLineDraft();
    this.formError = '';
    this.pageError = '';
    this.modalOpen = true;
  }

  openEdit(quote: SalesQuote): void {
    if (quote.status !== 'Draft') return;
    this.editingId = quote._id;
    this.draft = {
      customerId: quote.customerId,
      branchId: quote.branchId ?? '',
      discountRate: quote.discountRate ?? 0,
      taxRate: quote.taxRate,
      validUntil: quote.validUntil ? quote.validUntil.slice(0, 10) : '',
      proposalType: quote.proposalType ?? 'Sales',
      warrantyType: quote.warrantyType ?? 'Not Applicable',
      warrantyFrom: quote.warrantyFrom ?? 'Not Applicable',
      installationBy: quote.installationBy ?? 'Not Applicable',
      preventiveMaintenance: quote.preventiveMaintenance ?? 'Not Applicable',
      proposalDetails: { ...emptyQuoteProposalDetails(), ...(quote.proposalDetails ?? {}) },
      notes: quote.notes,
      termsAndConditions: quote.termsAndConditions ?? this.profile.defaultTerms
    };
    this.loadCustomerBranches(quote.customerId, quote.branchId ?? '');
    this.draftLines = quote.lineItems.map(line => ({
      inventoryItemId: line.inventoryItemId ?? '',
      sku: line.sku,
      hsnCode: line.hsnCode ?? '',
      name: line.name,
      description: line.description,
      unit: line.unit,
      warranty: line.warranty ?? 'Not Applicable',
      brand: line.brand ?? '',
      modelNumber: line.modelNumber ?? '',
      specifications: line.specifications ?? '',
      serialNumber: line.serialNumber ?? '',
      condition: line.condition ?? '',
      location: line.location ?? '',
      quantity: line.quantity,
      unitPrice: line.unitPrice
    }));
    this.lineDraft = emptyLineDraft();
    this.formError = '';
    this.pageError = '';
    this.modalOpen = true;
  }

  duplicateQuote(quote: SalesQuote): void {
    this.editingId = '';
    this.draft = {
      customerId: quote.customerId,
      branchId: quote.branchId ?? '',
      discountRate: quote.discountRate ?? 0,
      taxRate: quote.taxRate,
      validUntil: '',
      proposalType: quote.proposalType ?? 'Sales',
      warrantyType: quote.warrantyType ?? 'Not Applicable',
      warrantyFrom: quote.warrantyFrom ?? 'Not Applicable',
      installationBy: quote.installationBy ?? 'Not Applicable',
      preventiveMaintenance: quote.preventiveMaintenance ?? 'Not Applicable',
      proposalDetails: { ...emptyQuoteProposalDetails(), ...(quote.proposalDetails ?? {}) },
      notes: quote.notes,
      termsAndConditions: quote.termsAndConditions ?? this.profile.defaultTerms
    };
    this.loadCustomerBranches(quote.customerId, quote.branchId ?? '');
    this.draftLines = quote.lineItems.map(line => ({
      inventoryItemId: line.inventoryItemId ?? '',
      sku: line.sku,
      hsnCode: line.hsnCode ?? '',
      name: line.name,
      description: line.description,
      unit: line.unit,
      warranty: line.warranty ?? 'Not Applicable',
      brand: line.brand ?? '',
      modelNumber: line.modelNumber ?? '',
      specifications: line.specifications ?? '',
      serialNumber: line.serialNumber ?? '',
      condition: line.condition ?? '',
      location: line.location ?? '',
      quantity: line.quantity,
      unitPrice: line.unitPrice
    }));
    this.lineDraft = emptyLineDraft();
    this.formError = '';
    this.pageError = '';
    this.selectedQuote = null;
    this.modalOpen = true;
  }

  openPreview(quote: SalesQuote): void {
    this.selectedQuote = quote;
    this.cdr.detectChanges();
    const dialog = this.quotePreviewDialog?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }

  closePreview(): void {
    const dialog = this.quotePreviewDialog?.nativeElement;
    if (dialog?.open) dialog.close();
    this.selectedQuote = null;
  }

  onPreviewDialogClick(event: MouseEvent): void {
    if (event.target === this.quotePreviewDialog?.nativeElement) {
      this.closePreview();
    }
  }

  onPreviewDialogCancel(event: Event): void {
    event.preventDefault();
    this.closePreview();
  }

  printQuoteDocument(quote: SalesQuote): void {
    this.printQuote = quote;
    document.body.classList.add('printing-quote');
    this.cdr.detectChanges();
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-quote');
      this.clearPrintState();
    }, { once: true });
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  sellerFor(quote: SalesQuote): QuoteProfile {
    const current = { ...emptyQuoteProfile(), ...this.profile };
    const snapshot = { ...emptyQuoteProfile(), ...(quote.sellerSnapshot ?? {}) };
    return {
      ...current,
      ...snapshot,
      companyName: snapshot.companyName || current.companyName,
      companyAddress: snapshot.companyAddress || current.companyAddress,
      companyState: snapshot.companyState || current.companyState,
      companyPhone: snapshot.companyPhone || current.companyPhone,
      companyEmail: snapshot.companyEmail || current.companyEmail,
      companyWebsite: snapshot.companyWebsite || current.companyWebsite,
      companyPan: snapshot.companyPan || current.companyPan,
      companyGstin: snapshot.companyGstin || current.companyGstin,
      companyMsme: snapshot.companyMsme || current.companyMsme,
      bankName: snapshot.bankName || current.bankName,
      bankAccountNumber: snapshot.bankAccountNumber || current.bankAccountNumber,
      bankBranch: snapshot.bankBranch || current.bankBranch,
      bankIfsc: snapshot.bankIfsc || current.bankIfsc,
      contactName: snapshot.contactName || current.contactName,
      contactPhone: snapshot.contactPhone || current.contactPhone,
      contactMobile: snapshot.contactMobile || current.contactMobile,
      contactEmail: snapshot.contactEmail || current.contactEmail,
      authorizedSignatory: snapshot.authorizedSignatory || current.authorizedSignatory,
      defaultValidityDays: snapshot.defaultValidityDays || current.defaultValidityDays,
      defaultTerms: snapshot.defaultTerms || current.defaultTerms
    };
  }

  isInterState(quote: SalesQuote): boolean {
    const sellerState = this.sellerFor(quote).companyState.trim().toLowerCase();
    const customerState = (quote.customerState ?? '').trim().toLowerCase();
    return !!sellerState && !!customerState && sellerState !== customerState;
  }

  proposalDetailRows(quote: SalesQuote): { label: string; value: string }[] {
    const details = { ...emptyQuoteProposalDetails(), ...(quote.proposalDetails ?? {}) };
    const money = (value: number): string => new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 2
    }).format(value);
    const rows: [string, string | number][] = [];
    const type = quote.proposalType ?? 'Sales';
    if (type === 'Sales' || type === 'Unit') {
      rows.push(['Payment terms', details.paymentTerms], ['Delivery schedule', details.deliverySchedule],
        ['Freight / shipping', details.freightCharges ? money(details.freightCharges) : ''],
        ['Warranty period', details.warrantyPeriod], ['Returns / replacement', details.returnPolicy]);
    } else if (type === 'Rental') {
      rows.push(['Rental period', [details.rentalStartDate, details.rentalEndDate].filter(Boolean).join(' to ')],
        ['Billing cycle', details.rentalBillingCycle], ['Security deposit', details.securityDeposit ? money(details.securityDeposit) : ''],
        ['Payment terms', details.paymentTerms], ['Usage, care & return terms', details.rentalConditions]);
    } else if (type === 'AMC') {
      rows.push(['Coverage', details.coverageType], ['Contract period', [details.contractStartDate, details.contractEndDate].filter(Boolean).join(' to ')],
        ['Response time', details.responseSla], ['Preventive maintenance', details.preventiveMaintenanceFrequency],
        ['Payment terms', details.paymentTerms], ['Exclusions', details.exclusions]);
    } else if (type === 'MPS') {
      rows.push(['Mono CPP', details.monoRate ? money(details.monoRate) : ''], ['Color CPP', details.colorRate ? money(details.colorRate) : ''],
        ['Monthly mono commitment', details.minimumMonoPages], ['Monthly color commitment', details.minimumColorPages],
        ['Mono overage rate', details.monoOverageRate ? money(details.monoOverageRate) : ''],
        ['Color overage rate', details.colorOverageRate ? money(details.colorOverageRate) : ''],
        ['Included services', details.includedServices]);
      const estimate = details.monoRate * details.minimumMonoPages + details.colorRate * details.minimumColorPages;
      if (estimate) rows.push(['Estimated monthly minimum', money(estimate)]);
    } else if (type === 'ASP') {
      rows.push(['Service scope', details.serviceScope], ['Support tiers', details.supportTiers],
        ['Pricing basis', details.pricingBasis], ['Service rate', details.serviceRate ? money(details.serviceRate) : ''],
        ['Response SLA', details.responseSla], ['Escalation path', details.escalationPath],
        ['Operational boundaries', details.operationalBoundaries]);
    } else if (type === 'Visit charge') {
      rows.push(['Visit scope', details.visitScope], ['Callout fee', details.visitFee ? money(details.visitFee) : ''],
        ['Hourly labor', details.hourlyLaborRate ? `${money(details.hourlyLaborRate)} × ${details.laborHours} hours` : '',
        ], ['Travel / conveyance', details.travelCharges ? money(details.travelCharges) : ''],
        ['Emergency / out-of-hours', details.emergencyCharges ? money(details.emergencyCharges) : '']);
    }
    if (type === 'Sales' || type === 'Unit') {
      rows.push(['Delivery method', details.deliveryMethod], ['Payment milestones', details.paymentMilestones]);
    } else if (type === 'Rental') {
      rows.push(['Usage limit', details.rentalUsageLimit], ['Maintenance responsibility', details.maintenanceResponsibility],
        ['Damage / loss liability', details.damageLiability], ['Return conditions', details.returnConditions]);
    } else if (type === 'AMC') {
      rows.push(['Support window', details.serviceWindow], ['Resolution target', details.resolutionSla],
        ['Preventive visits / year', details.preventiveVisitsPerYear]);
    } else if (type === 'MPS') {
      const monthlyMinimum = details.monoRate * details.minimumMonoPages + details.colorRate * details.minimumColorPages;
      rows.push(['Billing frequency', details.mpsBillingFrequency], ['Meter reading', details.meterReadingProcess]);
      if (details.mpsBillingFrequency === 'Quarterly' && monthlyMinimum) {
        rows.push(['Quarterly minimum commitment', money(monthlyMinimum * 3)]);
      }
    } else if (type === 'ASP') {
      rows.push(['Support availability', details.supportAvailability], ['Included engineering hours', details.includedEngineerHours],
        ['Vendor escalation contact', details.vendorEscalationContact]);
    } else if (type === 'Visit charge') {
      const billableHours = Math.max(0, details.laborHours - details.includedLaborHours);
      rows.push(['Scheduled visit', details.visitDate], ['Estimated / included labor', `${details.laborHours} / ${details.includedLaborHours} hours`],
        ['Billable labor hours', billableHours], ['Travel distance', details.travelDistanceKm ? `${details.travelDistanceKm} km` : '']);
    }
    const displayRows: [string, string | number][] = rows
      .map(([label, value]): [string, string | number] => label === 'Hourly labor'
        ? [label, details.hourlyLaborRate ? `${money(details.hourlyLaborRate)} x ${Math.max(0, details.laborHours - details.includedLaborHours)} billable hours` : value]
        : [label, value]);
    return displayRows
      .filter(([, value]) => value !== '' && value !== 0)
      .map(([label, value]) => ({ label, value: String(value) }));
  }

  lineDetails(line: Pick<SalesLineItem, 'brand' | 'modelNumber' | 'serialNumber' | 'condition' | 'location' | 'specifications'>): string {
    return [
      line.brand && `Brand ${line.brand}`,
      line.modelNumber && `Model ${line.modelNumber}`,
      line.serialNumber && `S/N ${line.serialNumber}`,
      line.condition && `Condition ${line.condition}`,
      line.location && `Location ${line.location}`,
      line.specifications
    ].filter(Boolean).join(' · ');
  }

  hasLineDetails(lines: SalesLineItem[]): boolean {
    return lines.some(line => this.lineDetails(line).length > 0);
  }

  quoteAdditionalCharges(quote: SalesQuote): number {
    const details = quote.proposalDetails;
    if (!details) return 0;
    if (quote.proposalType === 'Sales' || quote.proposalType === 'Unit') return Number(details.freightCharges) || 0;
    if (quote.proposalType === 'MPS') {
      const monthly = (Number(details.monoRate) || 0) * (Number(details.minimumMonoPages) || 0) +
        (Number(details.colorRate) || 0) * (Number(details.minimumColorPages) || 0);
      return monthly * (details.mpsBillingFrequency === 'Quarterly' ? 3 : 1);
    }
    if (quote.proposalType === 'Visit charge') {
      const billableHours = Math.max(0, (Number(details.laborHours) || 0) - (Number(details.includedLaborHours) || 0));
      return (Number(details.visitFee) || 0) + (Number(details.hourlyLaborRate) || 0) * billableHours +
        (Number(details.travelCharges) || 0) + (Number(details.emergencyCharges) || 0);
    }
    return 0;
  }

  amountInWords(amount: number): string {
    const numberWords = (value: number): string => {
      const small = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      if (value < 20) return small[value];
      if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${small[value % 10]}` : ''}`;
      if (value < 1000) return `${small[Math.floor(value / 100)]} Hundred${value % 100 ? ` ${numberWords(value % 100)}` : ''}`;
      const groups: [number, string][] = [[1e7, 'Crore'], [1e5, 'Lakh'], [1000, 'Thousand']];
      for (const [size, label] of groups) {
        if (value >= size) return `${numberWords(Math.floor(value / size))} ${label}${value % size ? ` ${numberWords(value % size)}` : ''}`;
      }
      return '';
    };
    const rupees = Math.floor(Math.abs(amount));
    const paise = Math.round((Math.abs(amount) - rupees) * 100);
    return `${amount < 0 ? 'Minus ' : ''}${rupees ? numberWords(rupees) : 'Zero'} Rupees${paise ? ` and ${numberWords(paise)} Paise` : ''} Only`;
  }

  exportCsv(): void {
    const columns = ['Quote', 'Customer', 'Branch', 'Email', 'Phone', 'Status', 'Created', 'Valid until', 'Subtotal', 'Discount rate', 'Discount amount', 'Tax rate', 'Tax amount', 'Total', 'Notes'];
    const rows = this.sortedQuotes.map(quote => [
      quote.quoteNumber, quote.customerName, quote.branchName ?? '', quote.branchEmail || quote.customerEmail, quote.branchPhone || quote.customerPhone, quote.status,
      quote.createdAt.slice(0, 10), quote.validUntil?.slice(0, 10) ?? '', quote.subTotal,
      quote.discountRate ?? 0, quote.discountAmount ?? 0, quote.taxRate, quote.taxAmount, quote.total, quote.notes
    ]);
    const csv = [columns, ...rows].map(row => row.map(value => {
      let cell = String(value ?? '');
      if (/^[=+\-@]/.test(cell.trimStart())) cell = `'${cell}`;
      return `"${cell.replaceAll('"', '""')}"`;
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `quotes-${localDateKey(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  openRenewal(quote: SalesQuote): void {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    this.renewingQuote = quote;
    this.selectedQuote = null;
    this.renewalDate = localDateKey(date);
    this.formError = '';
  }

  closeRenewal(): void {
    this.renewingQuote = null;
    this.formError = '';
  }

  renewQuote(): void {
    const quote = this.renewingQuote;
    if (!quote || !this.renewalDate || this.renewalDate <= localDateKey(new Date())) {
      this.formError = 'Choose an expiry date after today.';
      return;
    }
    this.statusBusyId = quote._id;
    this.formError = '';
    this.sales.renewQuote(quote._id, this.renewalDate).subscribe({
      next: ({ quote: updated }) => {
        this.quotes = this.quotes.map(existing => existing._id === updated._id ? updated : existing);
        this.openPreview(updated);
        this.renewingQuote = null;
        this.statusBusyId = '';
        this.notice = `${updated.quoteNumber} renewed and marked sent.`;
        this.cdr.markForCheck();
      },
      error: error => {
        this.formError = error?.error?.message ?? 'Unable to renew this quote.';
        this.statusBusyId = '';
        this.cdr.markForCheck();
      }
    });
  }

  changePage(page: number): void {
    this.page = Math.min(this.pageCount, Math.max(1, page));
  }

  closeModal(): void {
    if (!this.saving) this.modalOpen = false;
  }

  onCustomerChange(customerId: string): void {
    this.loadCustomerBranches(customerId);
  }

  private loadCustomerBranches(customerId: string, selectedBranchId = ''): void {
    const requestId = ++this.branchRequestId;
    this.branches = [];
    this.branchError = '';
    this.branchesLoading = !!customerId;
    this.draft.branchId = selectedBranchId;
    if (!customerId) {
      this.cdr.markForCheck();
      return;
    }
    this.customersApi.getBranches(customerId).subscribe({
      next: ({ branches }) => {
        if (requestId !== this.branchRequestId || this.draft.customerId !== customerId) return;
        this.branches = (branches ?? []).filter(branch => branch.status === 'Active');
        if (selectedBranchId && !this.branches.some(branch => branch._id === selectedBranchId)) {
          this.draft.branchId = '';
        }
        this.branchesLoading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        if (requestId !== this.branchRequestId || this.draft.customerId !== customerId) return;
        this.branchError = error?.error?.message ?? 'Unable to load branches for this customer.';
        this.branchesLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectCatalogItem(id: string): void {
    const item = this.catalog.find(candidate => candidate._id === id);
    if (item) {
      this.lineDraft = {
        ...this.lineDraft,
        inventoryItemId: item._id,
        sku: item.sku,
        name: item.name,
        description: item.description,
        unit: item.unit,
        location: item.location,
        unitPrice: item.unitCost
      };
    } else {
      this.lineDraft = {
        ...this.lineDraft, inventoryItemId: '', sku: '', name: '', description: '', unit: 'unit', unitPrice: 0,
        brand: '', modelNumber: '', specifications: '', serialNumber: '', condition: '', location: ''
      };
    }
  }

  addLine(): void {
    this.formError = '';
    if (!this.lineDraft.name.trim() || !this.lineDraft.unit.trim() || this.lineDraft.quantity <= 0 || this.lineDraft.unitPrice < 0) {
      this.formError = 'Enter an item, unit, positive quantity, and valid unit price.';
      return;
    }
    this.draftLines = [...this.draftLines, {
      ...this.lineDraft,
      sku: this.lineDraft.sku.trim(),
      name: this.lineDraft.name.trim(),
      description: this.lineDraft.description.trim(),
      hsnCode: this.lineDraft.hsnCode.trim(),
      unit: this.lineDraft.unit.trim(),
      brand: this.lineDraft.brand?.trim() ?? '',
      modelNumber: this.lineDraft.modelNumber?.trim() ?? '',
      specifications: this.lineDraft.specifications?.trim() ?? '',
      serialNumber: this.lineDraft.serialNumber?.trim() ?? '',
      condition: this.lineDraft.condition?.trim() ?? '',
      location: this.lineDraft.location?.trim() ?? ''
    }];
    this.lineDraft = emptyLineDraft();
  }

  removeLine(index: number): void {
    this.draftLines = this.draftLines.filter((_line, lineIndex) => lineIndex !== index);
  }

  saveQuote(): void {
    if (this.saving) return;
    if (!this.draft.customerId || !this.draftLines.length) {
      this.formError = 'Choose a customer and add at least one line item.';
      return;
    }
    if (!Number.isFinite(this.draft.discountRate) || this.draft.discountRate < 0 || this.draft.discountRate > 100 ||
      !Number.isFinite(this.draft.taxRate) || this.draft.taxRate < 0 || this.draft.taxRate > 100) {
      this.formError = 'Discount and tax rates must be between 0 and 100.';
      return;
    }
    const detailAmounts = [
      this.draft.proposalDetails.freightCharges, this.draft.proposalDetails.securityDeposit,
      this.draft.proposalDetails.monoRate, this.draft.proposalDetails.colorRate,
      this.draft.proposalDetails.minimumMonoPages, this.draft.proposalDetails.minimumColorPages,
      this.draft.proposalDetails.monoOverageRate, this.draft.proposalDetails.colorOverageRate,
      this.draft.proposalDetails.serviceRate, this.draft.proposalDetails.visitFee,
      this.draft.proposalDetails.preventiveVisitsPerYear, this.draft.proposalDetails.includedEngineerHours,
      this.draft.proposalDetails.hourlyLaborRate, this.draft.proposalDetails.laborHours,
      this.draft.proposalDetails.includedLaborHours, this.draft.proposalDetails.travelCharges,
      this.draft.proposalDetails.travelDistanceKm, this.draft.proposalDetails.emergencyCharges
    ];
    if (detailAmounts.some(value => !Number.isFinite(Number(value)) || Number(value) < 0)) {
      this.formError = 'Proposal rates, volumes, deposits and charges must be zero or greater.';
      return;
    }
    if (!Number.isInteger(this.draft.proposalDetails.preventiveVisitsPerYear)) {
      this.formError = 'Preventive visits per year must be a whole number.';
      return;
    }
    const dateRange = this.draft.proposalType === 'Rental'
      ? [this.draft.proposalDetails.rentalStartDate, this.draft.proposalDetails.rentalEndDate]
      : this.draft.proposalType === 'AMC'
        ? [this.draft.proposalDetails.contractStartDate, this.draft.proposalDetails.contractEndDate]
        : null;
    if (dateRange?.[0] && dateRange[1] && dateRange[1] < dateRange[0]) {
      this.formError = 'The contract end date must be on or after its start date.';
      return;
    }
    this.saving = true;
    this.formError = '';
    const payload: QuotePayload = {
      customerId: this.draft.customerId,
      branchId: this.draft.branchId || undefined,
      proposalDetails: { ...this.draft.proposalDetails },
      discountRate: Number(this.draft.discountRate) || 0,
      taxRate: Number(this.draft.taxRate) || 0,
      validUntil: this.draft.validUntil || null,
      proposalType: this.draft.proposalType.trim(),
      warrantyType: this.draft.warrantyType.trim(),
      warrantyFrom: this.draft.warrantyFrom.trim(),
      installationBy: this.draft.installationBy.trim(),
      preventiveMaintenance: this.draft.preventiveMaintenance.trim(),
      notes: this.draft.notes.trim(),
      termsAndConditions: this.draft.termsAndConditions.trim(),
      lineItems: this.draftLines.map(line => ({
        inventoryItemId: line.inventoryItemId || undefined,
        sku: line.sku.trim(),
        name: line.name.trim(),
        description: line.description.trim(),
        unit: line.unit.trim(),
        hsnCode: line.hsnCode.trim(),
        warranty: line.warranty.trim(),
        brand: line.brand?.trim() ?? '',
        modelNumber: line.modelNumber?.trim() ?? '',
        specifications: line.specifications?.trim() ?? '',
        serialNumber: line.serialNumber?.trim() ?? '',
        condition: line.condition?.trim() ?? '',
        location: line.location?.trim() ?? '',
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice)
      }))
    };
    const request = this.editingId
      ? this.sales.updateQuote(this.editingId, payload)
      : this.sales.createQuote(payload);
    request.subscribe({
      next: ({ quote }) => {
        this.quotes = this.editingId
          ? this.quotes.map(existing => existing._id === quote._id ? quote : existing)
          : [quote, ...this.quotes];
        this.notice = `${quote.quoteNumber} saved as a draft.`;
        this.saving = false;
        this.modalOpen = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.formError = error?.error?.message ?? 'Unable to save this quote.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  setStatus(quote: SalesQuote, status: QuoteStatus): void {
    if (this.statusBusyId || quote.status === status) return;
    this.statusBusyId = quote._id;
    this.pageError = '';
    this.sales.updateQuoteStatus(quote._id, status).subscribe({
      next: ({ quote: updated }) => {
        this.quotes = this.quotes.map(existing => existing._id === updated._id ? updated : existing);
        if (this.selectedQuote?._id === updated._id) this.selectedQuote = updated;
        this.statusBusyId = '';
        this.notice = `${updated.quoteNumber} marked ${updated.status.toLowerCase()}.`;
        this.cdr.markForCheck();
      },
      error: error => {
        this.pageError = error?.error?.message ?? 'Unable to update quote status.';
        this.statusBusyId = '';
        this.cdr.markForCheck();
      }
    });
  }

  convertToOrder(quote: SalesQuote): void {
    if (this.convertingId) return;
    this.convertingId = quote._id;
    this.pageError = '';
    this.sales.convertQuote(quote._id).subscribe({
      next: ({ order }) => {
        if (!this.orders.some(existing => existing._id === order._id)) this.orders = [order, ...this.orders];
        this.notice = `${quote.quoteNumber} converted to ${order.orderNumber}.`;
        this.convertingId = '';
        this.cdr.markForCheck();
      },
      error: error => {
        this.pageError = error?.error?.message ?? 'Unable to create the sales order.';
        this.convertingId = '';
        this.cdr.markForCheck();
      }
    });
  }

  orderForQuote(quote: SalesQuote): SalesOrder | undefined {
    return this.orders.find(order => order.quoteId === quote._id);
  }

  isPastDue(quote: SalesQuote): boolean {
    if (!quote.validUntil) return false;
    return quote.validUntil.slice(0, 10) < localDateKey(new Date());
  }

  statusTone(status: QuoteStatus): string {
    return `quote-${status.toLowerCase()}`;
  }
}
