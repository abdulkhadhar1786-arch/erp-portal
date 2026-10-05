import mongoose, { Schema } from 'mongoose';
const branchSchema = new Schema({
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    state: { type: String, trim: true, maxlength: 100, default: '' },
    pincode: { type: String, trim: true, maxlength: 20, default: '' },
    username: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true }
}, { timestamps: true });
branchSchema.index({ customerId: 1, code: 1 }, { unique: true });
export const Branch = mongoose.model('Branch', branchSchema);
