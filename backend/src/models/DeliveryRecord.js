import mongoose, { Schema } from 'mongoose';
const deliverySchema = new Schema({
    deliveryNumber: { type: String, required: true, unique: true, index: true },
    stockDocumentId: { type: String, required: true, unique: true, index: true },
    challanNumber: { type: String, required: true, index: true },
    salesOrderId: { type: String, trim: true, default: '', index: true },
    salesOrderNumber: { type: String, trim: true, default: '' },
    customerName: { type: String, required: true, trim: true, maxlength: 160 },
    recipient: { type: String, trim: true, maxlength: 120, default: '' },
    carrier: { type: String, trim: true, maxlength: 120, default: '' },
    trackingNumber: { type: String, trim: true, maxlength: 120, default: '' },
    status: { type: String, enum: ['Prepared', 'In Transit', 'Delivered', 'Failed', 'Returned'], default: 'Prepared', index: true },
    deliveredAt: { type: Date, default: null },
    createdBy: { type: String, required: true, trim: true, maxlength: 120 }
}, { timestamps: true });
deliverySchema.index({ status: 1, createdAt: -1 });
export const DeliveryRecord = mongoose.model('DeliveryRecord', deliverySchema);
