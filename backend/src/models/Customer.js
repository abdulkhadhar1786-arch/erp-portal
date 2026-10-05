import mongoose, { Schema } from 'mongoose';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
function customerDataKey() {
    const secret = process.env['AUTH_SECRET'];
    if (!secret || secret.length < 24)
        throw new Error('AUTH_SECRET must be configured to protect customer banking data.');
    return createHash('sha256').update(`customer-bank-data:${secret}`).digest();
}
function encryptBankAccount(value) {
    if (!value || value.startsWith('enc:v1:'))
        return value;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', customerDataKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `enc:v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext.toString('hex')}`;
}
function decryptBankAccount(value) {
    if (!value || !value.startsWith('enc:v1:'))
        return value;
    const [, , ivHex, tagHex, ciphertextHex] = value.split(':');
    if (!ivHex || !tagHex || !ciphertextHex)
        throw new Error('Stored customer bank account data is malformed.');
    const decipher = createDecipheriv('aes-256-gcm', customerDataKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]).toString('utf8');
}
const customerSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    contactPerson: { type: String, trim: true, maxlength: 120, default: '' },
    industry: { type: String, trim: true, maxlength: 100, default: '' },
    website: { type: String, trim: true, maxlength: 254, default: '' },
    tradeName: { type: String, trim: true, maxlength: 120, default: '' },
    customerType: { type: String, enum: ['Individual', 'Private Ltd', 'Partnership', 'Public Ltd', 'Proprietorship'], default: 'Private Ltd' },
    designation: { type: String, trim: true, maxlength: 100, default: '' },
    secondaryContactName: { type: String, trim: true, maxlength: 120, default: '' },
    secondaryContactDesignation: { type: String, trim: true, maxlength: 100, default: '' },
    secondaryContactPhone: { type: String, trim: true, maxlength: 40, default: '' },
    secondaryContactEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    department: { type: String, trim: true, maxlength: 80, default: '' },
    billingAddress: { type: new Schema({
            building: { type: String, trim: true, maxlength: 120, default: '' },
            street: { type: String, trim: true, maxlength: 160, default: '' },
            area: { type: String, trim: true, maxlength: 120, default: '' },
            city: { type: String, trim: true, maxlength: 100, default: '' },
            state: { type: String, trim: true, maxlength: 100, default: '' },
            country: { type: String, trim: true, maxlength: 80, default: 'India' },
            pincode: { type: String, trim: true, maxlength: 20, default: '' }
        }, { _id: false }), default: () => ({}) },
    shippingAddress: { type: new Schema({
            building: { type: String, trim: true, maxlength: 120, default: '' },
            street: { type: String, trim: true, maxlength: 160, default: '' },
            area: { type: String, trim: true, maxlength: 120, default: '' },
            city: { type: String, trim: true, maxlength: 100, default: '' },
            state: { type: String, trim: true, maxlength: 100, default: '' },
            country: { type: String, trim: true, maxlength: 80, default: 'India' },
            pincode: { type: String, trim: true, maxlength: 20, default: '' }
        }, { _id: false }), default: () => ({}) },
    branchOfficeName: { type: String, trim: true, maxlength: 120, default: '' },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 15, default: '' },
    gstRegistrationType: { type: String, enum: ['Registered Regular', 'Composition', 'SEZ Unit/Developer', 'Unregistered', 'Overseas', 'Deemed Export'], default: 'Unregistered' },
    placeOfSupplyCode: { type: String, trim: true, maxlength: 2, default: '' },
    pan: { type: String, trim: true, uppercase: true, maxlength: 10, default: '' },
    tan: { type: String, trim: true, uppercase: true, maxlength: 10, default: '' },
    udyamNumber: { type: String, trim: true, uppercase: true, maxlength: 30, default: '' },
    lutNumber: { type: String, trim: true, uppercase: true, maxlength: 40, default: '' },
    iecCode: { type: String, trim: true, uppercase: true, maxlength: 10, default: '' },
    paymentTerms: { type: String, enum: ['Immediate', 'Net 15', 'Net 30', 'Net 60', 'Advance'], default: 'Immediate' },
    creditDays: { type: Number, min: 0, max: 3650, default: 0 },
    creditLimit: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'INR' },
    discountPercentage: { type: Number, min: 0, max: 100, default: 0 },
    priceListTier: { type: String, trim: true, maxlength: 80, default: '' },
    preferredPaymentMethod: { type: String, enum: ['NEFT/RTGS', 'UPI', 'Cheque', 'PDC'], default: 'NEFT/RTGS' },
    bankAccountHolderName: { type: String, trim: true, maxlength: 120, default: '' },
    bankName: { type: String, trim: true, maxlength: 120, default: '' },
    bankAccountNumber: { type: String, trim: true, maxlength: 256, default: '', select: false, set: encryptBankAccount, get: decryptBankAccount },
    bankIfsc: { type: String, trim: true, uppercase: true, maxlength: 11, default: '' },
    bankBranchName: { type: String, trim: true, maxlength: 120, default: '' },
    accountManager: { type: String, trim: true, maxlength: 120, default: '' },
    assignedBranch: { type: String, trim: true, maxlength: 120, default: '' },
    contractDetails: { type: String, trim: true, maxlength: 2000, default: '' },
    contractRenewalDate: { type: Date, default: null },
    contractExpiryDate: { type: Date, default: null },
    internalNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 100, default: '' },
    status: { type: String, enum: ['Active', 'On Hold', 'Blacklisted', 'Inactive'], default: 'Active', index: true },
    portalUsername: { type: String, trim: true, lowercase: true, unique: true, sparse: true, maxlength: 80 },
    portalPasswordHash: { type: String, select: false },
    sourceLeadId: { type: String, trim: true, unique: true, sparse: true, index: true }
}, { timestamps: true });
export const Customer = mongoose.model('Customer', customerSchema);
