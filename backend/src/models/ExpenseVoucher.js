import mongoose, { Schema } from 'mongoose';
const expenseSchema = new Schema({
    voucherNumber: { type: String, required: true, unique: true, index: true },
    voucherDate: { type: Date, required: true, index: true },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    payee: { type: String, required: true, trim: true, maxlength: 160 },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, required: true, trim: true, maxlength: 40 },
    reference: { type: String, trim: true, maxlength: 120, default: '' },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['Draft', 'Approved', 'Paid', 'Rejected'], default: 'Draft', index: true },
    createdBy: { type: String, required: true, trim: true, maxlength: 120 },
    approvedBy: { type: String, trim: true, default: '' },
    paidAt: { type: Date, default: null }
}, { timestamps: true });
expenseSchema.index({ voucherDate: -1, status: 1 });
export const ExpenseVoucher = mongoose.model('ExpenseVoucher', expenseSchema);
