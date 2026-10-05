import mongoose, { Schema } from 'mongoose';
const lineSchema = new Schema({
    inventoryItemId: { type: String, required: true },
    sku: { type: String, required: true },
    itemName: { type: String, required: true },
    unit: { type: String, required: true },
    quantityOrdered: { type: Number, required: true, min: 0.01 },
    quantityReceived: { type: Number, required: true, min: 0, default: 0 },
    unitCost: { type: Number, required: true, min: 0 }
}, { _id: false });
const purchaseOrderSchema = new Schema({
    purchaseOrderNumber: { type: String, required: true, unique: true, index: true },
    vendorId: { type: String, required: true, index: true },
    vendorName: { type: String, required: true, trim: true },
    orderDate: { type: Date, required: true, default: Date.now, index: true },
    expectedDate: { type: Date, default: null },
    status: { type: String, enum: ['Draft', 'Placed', 'Receiving', 'Partially Received', 'Received', 'Cancelled'], default: 'Draft', index: true },
    lines: { type: [lineSchema], required: true, validate: (lines) => lines.length > 0 },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    createdBy: { type: String, required: true, trim: true }
}, { timestamps: true });
purchaseOrderSchema.index({ vendorId: 1, status: 1, orderDate: -1 });
export const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
