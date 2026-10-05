import mongoose, { Schema } from 'mongoose';
const spareIssueSchema = new Schema({
    issueNumber: { type: String, required: true, unique: true, index: true },
    requestId: { type: String, required: true, index: true },
    requestNumber: { type: String, required: true },
    ticketId: { type: String, required: true, index: true },
    ticketNumber: { type: String, required: true, index: true },
    inventoryItemId: { type: String, required: true, index: true },
    sku: { type: String, required: true },
    itemName: { type: String, required: true },
    unit: { type: String, required: true },
    unitCost: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0.01 },
    returnedQuantity: { type: Number, required: true, min: 0, default: 0 },
    customerName: { type: String, required: true },
    branchName: { type: String, required: true },
    issuedBy: { type: String, required: true, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    issuedAt: { type: Date, required: true, default: Date.now, index: true }
}, { timestamps: true });
spareIssueSchema.index({ requestId: 1, issuedAt: -1 });
export const SpareIssue = mongoose.model('SpareIssue', spareIssueSchema);
