import mongoose, { Schema } from 'mongoose';
const officeBranchSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    state: { type: String, trim: true, maxlength: 100, default: '' },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true }
}, { timestamps: true });
export const OfficeBranch = mongoose.model('OfficeBranch', officeBranchSchema);
