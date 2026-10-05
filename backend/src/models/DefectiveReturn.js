import mongoose, { Schema } from 'mongoose';
const defectiveReturnSchema = new Schema({
    returnNumber: { type: String, required: true, unique: true, index: true },
    issueId: { type: String, required: true, index: true },
    issueNumber: { type: String, required: true },
    ticketId: { type: String, required: true, index: true },
    ticketNumber: { type: String, required: true, index: true },
    inventoryItemId: { type: String, required: true, index: true },
    sku: { type: String, required: true },
    itemName: { type: String, required: true },
    customerName: { type: String, required: true },
    branchName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['Submitted', 'Received', 'Rejected'], default: 'Submitted', index: true },
    submittedBy: { type: String, required: true, trim: true, maxlength: 120 },
    receivedBy: { type: String, trim: true, maxlength: 120, default: '' },
    receivedAt: { type: Date, default: null }
}, { timestamps: true });
defectiveReturnSchema.index({ status: 1, createdAt: -1 });
export const DefectiveReturn = mongoose.model('DefectiveReturn', defectiveReturnSchema);
