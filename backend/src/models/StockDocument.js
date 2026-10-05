import mongoose, { Schema } from 'mongoose';
const lineSchema = new Schema({
    inventoryItemId: { type: String, required: true, index: true },
    sku: { type: String, required: true },
    itemName: { type: String, required: true },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    direction: { type: String, enum: ['In', 'Out'], required: true },
    unitCost: { type: Number, required: true, min: 0 }
}, { _id: false });
const stockDocumentSchema = new Schema({
    documentNumber: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['Goods Receipt', 'Delivery Challan', 'Inventory Adjustment', 'Inward Challan', 'Outward Challan'], required: true, index: true },
    partyName: { type: String, trim: true, maxlength: 160, default: '' },
    purchaseOrderId: { type: String, trim: true, default: '', index: true },
    purchaseOrderNumber: { type: String, trim: true, default: '' },
    salesOrderId: { type: String, trim: true, default: '', index: true },
    salesOrderNumber: { type: String, trim: true, default: '' },
    reference: { type: String, trim: true, maxlength: 120, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    lines: { type: [lineSchema], required: true, validate: (lines) => lines.length > 0 },
    createdBy: { type: String, required: true, trim: true, maxlength: 120 },
    postedAt: { type: Date, required: true, default: Date.now, index: true }
}, { timestamps: true });
stockDocumentSchema.index({ type: 1, postedAt: -1 });
export const StockDocument = mongoose.model('StockDocument', stockDocumentSchema);
