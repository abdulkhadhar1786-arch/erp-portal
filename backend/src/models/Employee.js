import mongoose, { Schema } from 'mongoose';
const employeeSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    passwordHash: { type: String, default: '', select: false },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    jobTitle: { type: String, trim: true, maxlength: 100, default: '' },
    department: { type: String, trim: true, maxlength: 100, default: '' },
    officeBranchId: { type: Schema.Types.ObjectId, ref: 'OfficeBranch', required: true, index: true },
    hireDate: { type: Date, default: null },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true }
}, { timestamps: true });
employeeSchema.index({ name: 1 });
export const Employee = mongoose.model('Employee', employeeSchema);
