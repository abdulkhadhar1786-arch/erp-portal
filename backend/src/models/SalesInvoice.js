import mongoose, { Schema } from 'mongoose';
const invoiceSchema = new Schema({
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, unique: true, index: true },
    orderNumber: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true, trim: true },
    issueDate: { type: Date, required: true, default: Date.now, index: true },
    dueDate: { type: Date, default: null },
    subTotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    roundOff: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, min: 0, default: 0 },
    payments: { type: [{
                amount: { type: Number, required: true, min: 0.01 },
                paymentDate: { type: Date, required: true },
                method: { type: String, required: true, trim: true, maxlength: 40 },
                reference: { type: String, trim: true, maxlength: 120, default: '' },
                notes: { type: String, trim: true, maxlength: 500, default: '' },
                receivedBy: { type: String, required: true, trim: true, maxlength: 120 }
            }], default: [] },
    status: { type: String, enum: ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Voided'], default: 'Draft', index: true },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    createdBy: { type: String, required: true, trim: true },
    paidAt: { type: Date, default: null }
}, { timestamps: true });
invoiceSchema.index({ status: 1, issueDate: -1 });
export const SalesInvoice = mongoose.model('SalesInvoice', invoiceSchema);
