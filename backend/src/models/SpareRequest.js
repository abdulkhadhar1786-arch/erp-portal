import mongoose, { Schema } from 'mongoose';
const spareRequestSchema = new Schema({
    requestNumber: { type: String, required: true, unique: true, index: true },
    ticketId: { type: String, required: true, index: true },
    ticketNumber: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    branchId: { type: String, required: true },
    branchName: { type: String, required: true },
    inventoryItemId: { type: String, required: true, index: true },
    sku: { type: String, required: true },
    itemName: { type: String, required: true },
    unit: { type: String, required: true },
    unitCost: { type: Number, required: true, min: 0 },
    quantityRequested: { type: Number, required: true, min: 0.01 },
    quantityIssued: { type: Number, required: true, min: 0, default: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    requestedBy: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ['Requested', 'Partially Issued', 'Issuing', 'Issued', 'Rejected'], default: 'Requested', index: true }
}, { timestamps: true });
spareRequestSchema.index({ status: 1, createdAt: -1 });
export const SpareRequest = mongoose.model('SpareRequest', spareRequestSchema);
