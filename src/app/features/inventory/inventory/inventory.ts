import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InventoryItem, InventoryPayload, InventoryService, InventoryStatus } from '../../../core/services/inventory.service';

interface InventoryDraft {
  sku: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost: number;
  supplier: string;
  location: string;
  status: InventoryStatus;
}

function emptyDraft(): InventoryDraft {
  return {
    sku: '', name: '', category: '', description: '', unit: 'unit',
    quantityOnHand: 0, reorderLevel: 0, unitCost: 0,
    supplier: '', location: '', status: 'Active'
  };
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventory.html',
  styleUrl: './inventory.css'
})
export class Inventory implements OnInit {
  items: InventoryItem[] = [];
  loading = true;
  saving = false;
  modalOpen = false;
  editingId = '';
  searchText = '';
  categoryFilter = '';
  stockFilter = '';
  errorMessage = '';
  draft = emptyDraft();

  constructor(private inventory: InventoryService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.inventory.getItems().subscribe({
      next: response => {
        this.items = response.items ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to load inventory.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get categories(): string[] {
    return [...new Set(this.items.map(item => item.category))].sort((left, right) => left.localeCompare(right));
  }

  get activeItems(): InventoryItem[] {
    return this.items.filter(item => item.status === 'Active');
  }

  get lowStockCount(): number {
    return this.activeItems.filter(item => item.quantityOnHand <= item.reorderLevel).length;
  }

  get stockValue(): number {
    return this.activeItems.reduce((total, item) => total + item.quantityOnHand * item.unitCost, 0);
  }

  get filteredItems(): InventoryItem[] {
    const query = this.searchText.trim().toLowerCase();
    return this.items.filter(item => {
      const matchesQuery = !query || [item.sku, item.name, item.category, item.supplier, item.location]
        .some(value => value.toLowerCase().includes(query));
      const matchesCategory = !this.categoryFilter || item.category === this.categoryFilter;
      const matchesStock = !this.stockFilter || (
        this.stockFilter === 'out' ? item.quantityOnHand === 0 :
          this.stockFilter === 'low' ? item.quantityOnHand > 0 && item.quantityOnHand <= item.reorderLevel :
            item.quantityOnHand > item.reorderLevel
      );
      return matchesQuery && matchesCategory && matchesStock;
    });
  }

  stockState(item: InventoryItem): 'Out of stock' | 'Reorder' | 'In stock' {
    if (item.quantityOnHand <= 0) return 'Out of stock';
    if (item.quantityOnHand <= item.reorderLevel) return 'Reorder';
    return 'In stock';
  }

  stockTone(item: InventoryItem): string {
    return this.stockState(item).toLowerCase().replaceAll(' ', '-');
  }

  openCreate(): void {
    this.editingId = '';
    this.draft = emptyDraft();
    this.errorMessage = '';
    this.modalOpen = true;
  }

  openEdit(item: InventoryItem): void {
    this.editingId = item._id;
    this.draft = {
      sku: item.sku,
      name: item.name,
      category: item.category,
      description: item.description,
      unit: item.unit,
      quantityOnHand: item.quantityOnHand,
      reorderLevel: item.reorderLevel,
      unitCost: item.unitCost,
      supplier: item.supplier,
      location: item.location,
      status: item.status
    };
    this.errorMessage = '';
    this.modalOpen = true;
  }

  closeModal(): void {
    if (!this.saving) this.modalOpen = false;
  }

  saveItem(): void {
    if (this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    const payload: InventoryPayload = {
      ...this.draft,
      sku: this.draft.sku.trim().toUpperCase(),
      name: this.draft.name.trim(),
      category: this.draft.category.trim(),
      description: this.draft.description.trim(),
      unit: this.draft.unit.trim(),
      supplier: this.draft.supplier.trim(),
      location: this.draft.location.trim()
    };
    const request = this.editingId
      ? this.inventory.updateItem(this.editingId, payload)
      : this.inventory.createItem(payload);
    request.subscribe({
      next: ({ item }) => {
        this.items = this.editingId
          ? this.items.map(existing => existing._id === item._id ? item : existing)
          : [...this.items, item].sort((left, right) => left.name.localeCompare(right.name));
        this.saving = false;
        this.modalOpen = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to save this inventory item.';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
