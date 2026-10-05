import mongoose, { Schema } from 'mongoose';
const inventoryItemSchema = new Schema({
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 40, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140, index: true },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    unit: { type: String, required: true, trim: true, maxlength: 24, default: 'unit' },
    quantityOnHand: { type: Number, required: true, min: 0, default: 0 },
    reorderLevel: { type: Number, required: true, min: 0, default: 0 },
    unitCost: { type: Number, required: true, min: 0, default: 0 },
    supplier: { type: String, trim: true, maxlength: 120, default: '' },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true }
}, { timestamps: true });
inventoryItemSchema.index({ status: 1, category: 1, name: 1 });
export const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
