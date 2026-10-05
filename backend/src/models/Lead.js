import mongoose, { Schema } from 'mongoose';
export const leadStages = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
export const leadSources = ['Website', 'Referral', 'Outbound', 'Partner', 'Event', 'Other'];
const leadSchema = new Schema({
    leadNumber: { type: String, required: true, unique: true, trim: true, index: true },
    companyName: { type: String, required: true, trim: true, maxlength: 120, index: true },
    contactName: { type: String, trim: true, maxlength: 120, default: '' },
    contactTitle: { type: String, trim: true, maxlength: 100, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    industry: { type: String, trim: true, maxlength: 100, default: '' },
    source: { type: String, enum: leadSources, default: 'Other' },
    stage: { type: String, enum: leadStages, default: 'New', index: true },
    expectedValue: { type: Number, min: 0, default: 0 },
    probability: { type: Number, min: 0, max: 100, default: 10 },
    targetCloseDate: { type: Date, default: null },
    campaign: { type: String, trim: true, maxlength: 120, default: '' },
    competitor: { type: String, trim: true, maxlength: 120, default: '' },
    lostReason: { type: String, trim: true, maxlength: 500, default: '' },
    owner: { type: String, trim: true, maxlength: 120, default: '' },
    nextFollowUp: { type: Date, default: null, index: true },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    customerId: { type: String, trim: true, default: '', index: true }
}, { timestamps: true });
leadSchema.index({ stage: 1, updatedAt: -1 });
export const Lead = mongoose.model('Lead', leadSchema);
