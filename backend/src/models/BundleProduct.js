import mongoose, { Schema } from 'mongoose';
const componentSchema = new Schema({
    inventoryItemId: { type: String, required: true },
    sku: { type: String, required: true },
    itemName: { type: String, required: true },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 }
}, { _id: false });
const bundleSchema = new Schema({
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 40, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    salePrice: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    components: { type: [componentSchema], required: true, validate: (components) => components.length > 0 }
}, { timestamps: true });
bundleSchema.index({ status: 1, category: 1, name: 1 });
export const BundleProduct = mongoose.model('BundleProduct', bundleSchema);
