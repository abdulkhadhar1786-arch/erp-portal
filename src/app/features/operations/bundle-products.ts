import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BundlePayload, BundleProduct, OperationsService } from '../../core/services/operations.service';
import { InventoryItem, InventoryService } from '../../core/services/inventory.service';
import { forkJoin } from 'rxjs';

const blankBundle = (): BundlePayload => ({ sku: '', name: '', category: '', description: '', salePrice: 0, status: 'Active', components: [] });

@Component({
  selector: 'app-bundle-products', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './bundle-products.html'
})
export class BundleProducts implements OnInit {
  bundles: BundleProduct[] = [];
  inventory: InventoryItem[] = [];
  draft = blankBundle();
  selectedItemId = '';
  componentQuantity = 1;
  editingId = '';
  loading = true;
  saving = false;
  error = '';
  notice = '';

  constructor(private api: OperationsService, private inventoryApi: InventoryService, private cdr: ChangeDetectorRef) {}
  ngOnInit(): void { this.load(); }
  load(): void {
    this.loading = true;
    forkJoin({ bundles: this.api.getBundles(), inventory: this.inventoryApi.getItems() }).subscribe({
      next: data => { this.bundles = data.bundles.bundles ?? []; this.inventory = data.inventory.items ?? []; this.loading = false; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to load bundle products.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }
  get activeItems(): InventoryItem[] { return this.inventory.filter(item => item.status === 'Active'); }
  availableBuilds(bundle: BundleProduct): number {
    if (!bundle.components.length) return 0;
    return Math.min(...bundle.components.map(component => {
      const item = this.inventory.find(row => row._id === component.inventoryItemId);
      return item ? Math.floor(item.quantityOnHand / component.quantity) : 0;
    }));
  }
  addComponent(): void {
    const item = this.activeItems.find(row => row._id === this.selectedItemId);
    if (!item || this.componentQuantity < 1) return;
    const existing = this.draft.components.find(row => row.inventoryItemId === item._id);
    if (existing) existing.quantity += Number(this.componentQuantity);
    else this.draft.components = [...this.draft.components, { inventoryItemId: item._id, sku: item.sku, itemName: item.name, unit: item.unit, quantity: Number(this.componentQuantity) }];
    this.selectedItemId = ''; this.componentQuantity = 1;
  }
  removeComponent(id: string): void { this.draft.components = this.draft.components.filter(item => item.inventoryItemId !== id); }
  edit(bundle: BundleProduct): void {
    this.editingId = bundle._id;
    this.draft = { sku: bundle.sku, name: bundle.name, category: bundle.category, description: bundle.description, salePrice: bundle.salePrice, status: bundle.status, components: bundle.components.map(line => ({ ...line })) };
    this.notice = '';
  }
  save(): void {
    if (this.saving) return;
    this.saving = true; this.error = ''; this.notice = '';
    const request = this.editingId ? this.api.updateBundle(this.editingId, this.draft) : this.api.createBundle(this.draft);
    request.subscribe({
      next: ({ bundle }) => { this.bundles = this.editingId ? this.bundles.map(row => row._id === bundle._id ? bundle : row) : [bundle, ...this.bundles]; this.notice = `${bundle.sku} saved.`; this.cancel(); this.saving = false; this.cdr.markForCheck(); },
      error: error => { this.error = error?.error?.message ?? 'Unable to save bundle.'; this.saving = false; this.cdr.markForCheck(); }
    });
  }
  cancel(): void { this.editingId = ''; this.draft = blankBundle(); }
}
