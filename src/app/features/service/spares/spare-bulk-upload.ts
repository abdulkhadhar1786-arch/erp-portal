import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { InventoryPayload, InventoryService } from '../../../core/services/inventory.service';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      row.push(field); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); field = '';
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted field.');
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

@Component({
  selector: 'app-spare-bulk-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spare-bulk-upload.html'
})
export class SpareBulkUpload {
  rows: InventoryPayload[] = [];
  fileName = '';
  loading = false;
  importing = false;
  errorMessage = '';
  notice = '';

  constructor(private inventory: InventoryService, private cdr: ChangeDetectorRef) {}

  async selectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.rows = [];
    this.notice = '';
    this.errorMessage = '';
    if (!file) return;
    this.fileName = file.name;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.errorMessage = 'Choose a CSV file.';
      input.value = '';
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    try {
      this.rows = this.readRows(await file.text());
      if (!this.rows.length) this.errorMessage = 'The CSV does not contain any inventory rows.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to read this CSV file.';
      this.rows = [];
    }
    this.loading = false;
    this.cdr.markForCheck();
  }

  importRows(): void {
    if (this.importing || !this.rows.length) return;
    this.importing = true;
    this.errorMessage = '';
    this.notice = '';
    this.inventory.bulkImport(this.rows).subscribe({
      next: result => {
        this.notice = `Imported ${result.importedCount} rows: ${result.createdCount} new and ${result.updatedCount} updated. Existing stock balances preserved for ${result.preservedStockCount} items.`;
        this.rows = [];
        this.fileName = '';
        this.importing = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.errorMessage = error?.error?.message ?? 'Unable to import inventory rows.';
        this.importing = false;
        this.cdr.markForCheck();
      }
    });
  }

  downloadTemplate(): void {
    const csv = [
      'SKU,Name,Category,Unit,Quantity On Hand,Reorder Level,Unit Cost,Supplier,Location,Description,Status',
      'SP-1001,Control board,Electronics,unit,12,3,4500,Acme Parts,Main store,Controller replacement,Active'
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spare-stock-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  private readRows(text: string): InventoryPayload[] {
    const [headerRow, ...dataRows] = parseCsv(text);
    if (!headerRow) throw new Error('The CSV needs a header row.');
    const indexes = new Map(headerRow.map((header, index) => [headerKey(header), index]));
    const get = (row: string[], ...keys: string[]): string => {
      const index = keys.map(key => indexes.get(key)).find(value => value !== undefined);
      return index === undefined ? '' : (row[index] ?? '').trim();
    };
    const required = ['sku', 'name', 'category', 'quantityonhand', 'reorderlevel', 'unitcost'];
    const missing = required.filter(key => !indexes.has(key));
    if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}.`);
    if (dataRows.length > 500) throw new Error('Upload no more than 500 rows at a time.');

    const seen = new Set<string>();
    return dataRows.map((row, rowIndex) => {
      const line = rowIndex + 2;
      const sku = get(row, 'sku').toUpperCase();
      const name = get(row, 'name');
      const category = get(row, 'category');
      const rawQuantity = get(row, 'quantityonhand');
      const rawReorderLevel = get(row, 'reorderlevel');
      const rawUnitCost = get(row, 'unitcost');
      const quantityOnHand = Number(rawQuantity);
      const reorderLevel = Number(rawReorderLevel);
      const unitCost = Number(rawUnitCost);
      const statusText = get(row, 'status') || 'Active';
      const status = statusText === 'Inactive' ? 'Inactive' : statusText === 'Active' ? 'Active' : null;
      if (!/^[A-Z0-9][A-Z0-9._/-]{1,39}$/.test(sku) || !name || !category ||
        rawQuantity === '' || !Number.isFinite(quantityOnHand) || quantityOnHand < 0 ||
        rawReorderLevel === '' || !Number.isFinite(reorderLevel) || reorderLevel < 0 ||
        rawUnitCost === '' || !Number.isFinite(unitCost) || unitCost < 0 || !status) {
        throw new Error(`Check required fields and non-negative numeric values on CSV row ${line}.`);
      }
      if (seen.has(sku)) throw new Error(`Duplicate SKU ${sku} on CSV row ${line}.`);
      seen.add(sku);
      return {
        sku,
        name,
        category,
        description: get(row, 'description'),
        unit: get(row, 'unit') || 'unit',
        quantityOnHand,
        reorderLevel,
        unitCost,
        supplier: get(row, 'supplier'),
        location: get(row, 'location'),
        status
      };
    });
  }
}
