import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AssetPayload, AssetRecord, OperationsService } from '../../core/services/operations.service';
import { CustomerService, CustomerSummary } from '../../core/services/customer.service';
import { forkJoin } from 'rxjs';

type AssetMode = 'assets' | 'devices' | 'warranty';
const blankAsset = (): AssetPayload => ({
  assetTag: '', serialNumber: '', name: '', deviceType: '', status: 'Active', customerId: '',
  branchName: '', supplier: '', purchaseDate: '', warrantyStart: '', warrantyEnd: '', notes: ''
});

@Component({
  selector: 'app-asset-management', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './asset-management.html'
})
export class AssetManagement implements OnInit {
  mode: AssetMode = 'assets';
  assets: AssetRecord[] = [];
  customers: CustomerSummary[] = [];
  draft = blankAsset();
  editingId = '';
  loading = true;
  saving = false;
  error = '';
  notice = '';
  private prefillCustomerId = '';

  constructor(private route: ActivatedRoute, private api: OperationsService, private customersApi: CustomerService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.prefillCustomerId = this.route.snapshot.queryParamMap.get('customerId') ?? '';
    this.route.data.subscribe(data => { this.mode = data['mode'] as AssetMode; this.load(); });
  }

  load(): void {
    this.loading = true;
    forkJoin({ assets: this.api.getAssets(), customers: this.customersApi.getCustomers() }).subscribe({
      next: response => {
        this.assets = response.assets.assets ?? [];
        this.customers = (response.customers.customers ?? []).filter(customer => customer.status === 'Active');
        if (this.prefillCustomerId && this.mode === 'assets' && this.customers.some(customer => customer._id === this.prefillCustomerId)) {
          this.draft.customerId = this.prefillCustomerId;
          this.prefillCustomerId = '';
        }
        this.loading = false; this.cdr.markForCheck();
      },
      error: error => { this.error = error?.error?.message ?? 'Unable to load asset register.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }

  get pageTitle(): string { return this.mode === 'devices' ? 'Active devices' : this.mode === 'warranty' ? 'Warranty register' : 'Assets'; }
  get visibleAssets(): AssetRecord[] {
    if (this.mode === 'devices') return this.assets.filter(asset => asset.status === 'Active');
    if (this.mode === 'warranty') return this.assets.filter(asset => asset.warrantyEnd);
    return this.assets;
  }
  warrantyLabel(asset: AssetRecord): string {
    if (!asset.warrantyEnd) return 'Not recorded';
    const days = Math.ceil((new Date(asset.warrantyEnd).getTime() - Date.now()) / 86400000);
    return days < 0 ? 'Expired' : days <= 60 ? `Expires in ${days} days` : 'Covered';
  }
  edit(asset: AssetRecord): void {
    this.editingId = asset._id;
    this.draft = {
      assetTag: asset.assetTag, serialNumber: asset.serialNumber, name: asset.name, deviceType: asset.deviceType,
      status: asset.status, customerId: asset.customerId, branchName: asset.branchName, supplier: asset.supplier,
      purchaseDate: asset.purchaseDate?.slice(0, 10) ?? '', warrantyStart: asset.warrantyStart?.slice(0, 10) ?? '',
      warrantyEnd: asset.warrantyEnd?.slice(0, 10) ?? '', notes: asset.notes
    };
    this.notice = '';
  }
  save(): void {
    if (this.saving) return;
    this.saving = true; this.error = ''; this.notice = '';
    const request = this.editingId ? this.api.updateAsset(this.editingId, this.draft) : this.api.createAsset(this.draft);
    request.subscribe({
      next: ({ asset }) => {
        this.assets = this.editingId ? this.assets.map(row => row._id === asset._id ? asset : row) : [asset, ...this.assets];
        this.notice = `${asset.assetTag} saved.`; this.cancelEdit(); this.saving = false; this.cdr.markForCheck();
      },
      error: error => { this.error = error?.error?.message ?? 'Unable to save asset.'; this.saving = false; this.cdr.markForCheck(); }
    });
  }
  cancelEdit(): void { this.editingId = ''; this.draft = blankAsset(); }
}
