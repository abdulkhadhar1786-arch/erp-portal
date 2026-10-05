import mongoose, { Schema } from 'mongoose';
const vendorSchema = new Schema({
    vendorCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 40, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    contactName: { type: String, trim: true, maxlength: 120, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    taxNumber: { type: String, trim: true, uppercase: true, maxlength: 40, default: '' },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true }
}, { timestamps: true });
export const Vendor = mongoose.model('Vendor', vendorSchema);
