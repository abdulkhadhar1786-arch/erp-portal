import mongoose, { Schema } from 'mongoose';
const assetSchema = new Schema({
    assetTag: { type: String, required: true, trim: true, uppercase: true, maxlength: 40, unique: true, index: true },
    serialNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 100, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    deviceType: { type: String, required: true, trim: true, maxlength: 80, index: true },
    status: { type: String, enum: ['Active', 'In Repair', 'Retired'], default: 'Active', index: true },
    customerId: { type: String, trim: true, default: '', index: true },
    customerName: { type: String, trim: true, default: '' },
    branchName: { type: String, trim: true, maxlength: 160, default: '' },
    supplier: { type: String, trim: true, maxlength: 160, default: '' },
    purchaseDate: { type: Date, default: null },
    warrantyStart: { type: Date, default: null },
    warrantyEnd: { type: Date, default: null, index: true },
    notes: { type: String, trim: true, maxlength: 1000, default: '' }
}, { timestamps: true });
assetSchema.index({ status: 1, warrantyEnd: 1 });
export const AssetRecord = mongoose.model('AssetRecord', assetSchema);
