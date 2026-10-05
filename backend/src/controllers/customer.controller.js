import mongoose from 'mongoose';
import { Branch } from '../models/Branch.js';
import { CodeCounter } from '../models/CodeCounter.js';
import { Customer } from '../models/Customer.js';
import { Ticket } from '../models/Ticket.js';
import { hashPassword } from '../utils/password.js';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[a-z0-9._-]{3,80}$/;
function validWebsite(value) {
    try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
    }
    catch {
        return false;
    }
}
function readBody(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function readString(body, key) {
    return typeof body[key] === 'string' ? body[key].trim() : undefined;
}
function validStatus(value) {
    return value === 'Active' || value === 'Inactive';
}
function validCustomerStatus(value) {
    return value === 'Active' || value === 'On Hold' || value === 'Blacklisted' || value === 'Inactive';
}
function validId(value) {
    return typeof value === 'string' && mongoose.isValidObjectId(value);
}
const customerEnums = {
    customerType: ['Individual', 'Private Ltd', 'Partnership', 'Public Ltd', 'Proprietorship'],
    gstRegistrationType: ['Registered Regular', 'Composition', 'SEZ Unit/Developer', 'Unregistered', 'Overseas', 'Deemed Export'],
    paymentTerms: ['Immediate', 'Net 15', 'Net 30', 'Net 60', 'Advance'],
    preferredPaymentMethod: ['NEFT/RTGS', 'UPI', 'Cheque', 'PDC']
};
const customerStringLimits = {
    name: 120, email: 254, phone: 40, contactPerson: 120, industry: 100, website: 254,
    tradeName: 120, customerType: 40, designation: 100, secondaryContactName: 120,
    secondaryContactDesignation: 100, secondaryContactPhone: 40, secondaryContactEmail: 254,
    department: 80, branchOfficeName: 120, gstin: 15, gstRegistrationType: 40,
    placeOfSupplyCode: 2, pan: 10, tan: 10, udyamNumber: 30, lutNumber: 40, iecCode: 10,
    paymentTerms: 20, currency: 3, priceListTier: 80, preferredPaymentMethod: 20,
    bankAccountHolderName: 120, bankName: 120, bankAccountNumber: 40, bankIfsc: 11,
    bankBranchName: 120, accountManager: 120, assignedBranch: 120, contractDetails: 2000,
    internalNotes: 2000, address: 300, city: 100
};
function parseCustomerAddress(value) {
    const body = readBody(value);
    if (!body)
        return null;
    const limits = {
        building: 120, street: 160, area: 120, city: 100, state: 100, country: 80, pincode: 20
    };
    const address = {};
    for (const [field, limit] of Object.entries(limits)) {
        const raw = body[field];
        if (raw !== undefined && typeof raw !== 'string')
            return null;
        const text = typeof raw === 'string' ? raw.trim() : '';
        if (text.length > limit)
            return null;
        address[field] = text;
    }
    if (!address.country)
        address.country = 'India';
    return address;
}
function parseCustomerFields(body, requireName) {
    const fields = {};
    for (const [field, limit] of Object.entries(customerStringLimits)) {
        if (!(field in body))
            continue;
        const value = readString(body, field);
        if (value === undefined || value.length > limit)
            return null;
        fields[field] = value;
    }
    for (const field of Object.keys(customerEnums)) {
        if (field in fields && !customerEnums[field].includes(String(fields[field])))
            return null;
    }
    for (const field of ['billingAddress', 'shippingAddress']) {
        if (field in body) {
            const address = parseCustomerAddress(body[field]);
            if (!address)
                return null;
            fields[field] = address;
        }
    }
    for (const [field, min, max, integer] of [
        ['creditDays', 0, 3650, true], ['creditLimit', 0, Number.MAX_SAFE_INTEGER, false], ['discountPercentage', 0, 100, false]
    ]) {
        if (!(field in body))
            continue;
        const value = Number(body[field]);
        if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
            return null;
        fields[field] = value;
    }
    for (const field of ['contractRenewalDate', 'contractExpiryDate']) {
        if (!(field in body))
            continue;
        const raw = body[field];
        if (raw !== null && raw !== '' && typeof raw !== 'string')
            return null;
        const date = raw === null || raw === '' ? null : new Date(raw);
        if (date && Number.isNaN(date.getTime()))
            return null;
        fields[field] = date;
    }
    const name = fields['name'];
    const email = String(fields['email'] ?? '').toLowerCase();
    const website = String(fields['website'] ?? '');
    const secondaryEmail = String(fields['secondaryContactEmail'] ?? '').toLowerCase();
    if ((requireName && (typeof name !== 'string' || !name)) ||
        (email && !emailPattern.test(email)) || (secondaryEmail && !emailPattern.test(secondaryEmail)) ||
        (website && !validWebsite(website)))
        return null;
    if ('email' in fields)
        fields['email'] = email;
    if ('secondaryContactEmail' in fields)
        fields['secondaryContactEmail'] = secondaryEmail;
    if ('website' in fields && website && !/^https?:\/\//i.test(website))
        return null;
    const normalize = (field) => String(fields[field] ?? '').toUpperCase();
    for (const field of ['gstin', 'pan', 'tan', 'udyamNumber', 'lutNumber', 'iecCode', 'bankIfsc', 'currency']) {
        if (field in fields)
            fields[field] = normalize(field);
    }
    const gstin = normalize('gstin');
    const pan = normalize('pan');
    const tan = normalize('tan');
    const udyam = normalize('udyamNumber');
    const iec = normalize('iecCode');
    const ifsc = normalize('bankIfsc');
    const placeCode = String(fields['placeOfSupplyCode'] ?? '');
    const currency = normalize('currency');
    if ((gstin && !/^[A-Z0-9]{15}$/.test(gstin)) || (placeCode && !/^\d{2}$/.test(placeCode)) ||
        (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) || (tan && !/^[A-Z]{4}\d{5}[A-Z]$/.test(tan)) ||
        (udyam && !/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(udyam)) || (iec && !/^[A-Z0-9]{10}$/.test(iec)) ||
        (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) || (currency && !/^[A-Z]{3}$/.test(currency)))
        return null;
    if (body['status'] !== undefined) {
        if (!validCustomerStatus(body['status']))
            return null;
        fields['status'] = body['status'];
    }
    const billing = fields['billingAddress'];
    if (billing) {
        if (!('address' in fields))
            fields['address'] = [billing.building, billing.street, billing.area].filter(Boolean).join(', ');
        if (!('city' in fields))
            fields['city'] = billing.city;
    }
    return fields;
}
async function nextCode(counterName, prefix) {
    const counter = await CodeCounter.findByIdAndUpdate(counterName, { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return `${prefix}-${String(counter?.sequence ?? 1).padStart(4, '0')}`;
}
function publicCustomer(customer) {
    const { portalPasswordHash: _portalPasswordHash, bankAccountNumber: _bankAccountNumber, ...safeCustomer } = customer;
    return safeCustomer;
}
function publicBranch(branch) {
    return {
        ...branch,
        _id: String(branch._id),
        customerId: String(branch.customerId)
    };
}
function handleError(res, error, message) {
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ success: false, message: 'Customer or branch data is invalid.' });
        return;
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        res.status(409).json({ success: false, message: 'A customer, branch code, or username already exists.' });
        return;
    }
    console.error(message, error);
    res.status(500).json({ success: false, message });
}
export async function getCustomers(_req, res) {
    try {
        const [customers, branchCounts, ticketCounts] = await Promise.all([
            Customer.find().sort({ name: 1 }).lean(),
            Branch.aggregate([
                { $group: { _id: '$customerId', count: { $sum: 1 } } }
            ]),
            Ticket.aggregate([
                { $match: { status: { $nin: ['Resolved', 'Closed'] } } },
                { $group: { _id: '$customerId', count: { $sum: 1 } } }
            ])
        ]);
        const branchesByCustomer = new Map(branchCounts.map((row) => [String(row._id), row.count]));
        const ticketsByCustomer = new Map(ticketCounts.map((row) => [String(row._id), row.count]));
        const result = customers.map((customer) => {
            const id = String(customer._id);
            return {
                ...customer,
                _id: id,
                branchCount: branchesByCustomer.get(id) ?? 0,
                openTickets: ticketsByCustomer.get(id) ?? 0
            };
        });
        res.json({ success: true, count: result.length, customers: result });
    }
    catch (error) {
        handleError(res, error, 'Failed to load customers.');
    }
}
export async function createCustomer(req, res) {
    const body = readBody(req.body);
    if (!body) {
        res.status(400).json({ success: false, message: 'Customer details are required.' });
        return;
    }
    const details = parseCustomerFields(body, true);
    const portalUsername = (readString(body, 'portalUsername') ?? '').toLowerCase();
    const portalPassword = typeof body['portalPassword'] === 'string' ? body['portalPassword'] : '';
    const status = body['status'] === undefined ? 'Active' : body['status'];
    const hasPortalCredentials = !!portalUsername || !!portalPassword;
    if (!details || !validCustomerStatus(status) ||
        (hasPortalCredentials && (!portalUsername || !usernamePattern.test(portalUsername) || portalPassword.length < 12))) {
        res.status(400).json({ success: false, message: 'Check the customer fields, statutory identifiers, account status, and optional portal credentials.' });
        return;
    }
    try {
        const customer = await Customer.create({
            code: await nextCode('customer', 'CUS'),
            status,
            ...details,
            ...(portalUsername ? { portalUsername } : {}),
            ...(portalPassword ? { portalPasswordHash: await hashPassword(portalPassword) } : {})
        });
        res.status(201).json({
            success: true,
            message: 'Customer created successfully.',
            customer: { ...publicCustomer(customer.toObject()), branchCount: 0, openTickets: 0 }
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to create customer.');
    }
}
export async function getCustomerById(req, res) {
    const id = req.params['id'];
    if (!validId(id)) {
        res.status(400).json({ success: false, message: 'Customer ID is invalid.' });
        return;
    }
    try {
        const customerRecord = await Customer.findById(id).select('+bankAccountNumber');
        if (!customerRecord) {
            res.status(404).json({ success: false, message: 'Customer not found.' });
            return;
        }
        const customer = customerRecord.toObject();
        customer.bankAccountNumber = customerRecord.bankAccountNumber;
        const [branches, totalTickets, openTickets] = await Promise.all([
            Branch.find({ customerId: id }).sort({ name: 1 }).lean(),
            Ticket.countDocuments({ customerId: id }),
            Ticket.countDocuments({ customerId: id, status: { $nin: ['Resolved', 'Closed'] } })
        ]);
        const branchTicketCounts = await Ticket.aggregate([
            { $match: { branchId: { $in: branches.map((branch) => String(branch._id)) } } },
            { $match: { status: { $nin: ['Resolved', 'Closed'] } } },
            { $group: { _id: '$branchId', count: { $sum: 1 } } }
        ]);
        const ticketsByBranch = new Map(branchTicketCounts.map((row) => [String(row._id), row.count]));
        res.json({
            success: true,
            customer: {
                ...customer,
                _id: String(customer._id),
                totalTickets,
                openTickets,
                branches: branches.map((branch) => ({
                    ...publicBranch(branch),
                    openTickets: ticketsByBranch.get(String(branch._id)) ?? 0
                }))
            }
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to load customer.');
    }
}
export async function updateCustomer(req, res) {
    const id = req.params['id'];
    const body = readBody(req.body);
    if (!validId(id) || !body) {
        res.status(400).json({ success: false, message: 'Customer details are invalid.' });
        return;
    }
    const parsed = parseCustomerFields(body, false);
    if (!parsed) {
        res.status(400).json({ success: false, message: 'Customer fields or statutory identifiers are invalid.' });
        return;
    }
    const update = parsed;
    const portalUsername = readString(body, 'portalUsername');
    if (portalUsername !== undefined && portalUsername !== '') {
        const normalizedUsername = portalUsername.toLowerCase();
        if (!usernamePattern.test(normalizedUsername)) {
            res.status(400).json({ success: false, message: 'Portal username must be 3 to 80 characters using letters, numbers, dots, underscores, or hyphens.' });
            return;
        }
        update['portalUsername'] = normalizedUsername;
    }
    const portalPassword = body['portalPassword'];
    if (portalPassword !== undefined && portalPassword !== '') {
        if (typeof portalPassword !== 'string' || portalPassword.length < 12) {
            res.status(400).json({ success: false, message: 'Portal password must be at least 12 characters.' });
            return;
        }
        update['portalPasswordHash'] = await hashPassword(portalPassword);
    }
    if (!Object.keys(update).length || update['name'] === '') {
        res.status(400).json({ success: false, message: 'Provide valid customer fields to update.' });
        return;
    }
    try {
        const customer = await Customer.findByIdAndUpdate(id, { $set: update }, {
            new: true,
            runValidators: true
        });
        if (!customer) {
            res.status(404).json({ success: false, message: 'Customer not found.' });
            return;
        }
        res.json({ success: true, message: 'Customer updated successfully.', customer: publicCustomer(customer.toObject()) });
    }
    catch (error) {
        handleError(res, error, 'Failed to update customer.');
    }
}
export async function getBranches(req, res) {
    const customerId = req.params['customerId'];
    if (!validId(customerId)) {
        res.status(400).json({ success: false, message: 'Customer ID is invalid.' });
        return;
    }
    try {
        const exists = await Customer.exists({ _id: customerId });
        if (!exists) {
            res.status(404).json({ success: false, message: 'Customer not found.' });
            return;
        }
        const branches = await Branch.find({ customerId }).sort({ name: 1 }).lean();
        res.json({ success: true, count: branches.length, branches: branches.map(publicBranch) });
    }
    catch (error) {
        handleError(res, error, 'Failed to load branches.');
    }
}
export async function createBranch(req, res) {
    const customerId = req.params['customerId'];
    const body = readBody(req.body);
    if (!validId(customerId) || !body) {
        res.status(400).json({ success: false, message: 'Customer or branch details are invalid.' });
        return;
    }
    const name = readString(body, 'name');
    const phone = readString(body, 'phone') ?? '';
    const email = readString(body, 'email') ?? '';
    const address = readString(body, 'address') ?? '';
    const city = readString(body, 'city') ?? '';
    const state = readString(body, 'state') ?? '';
    const pincode = readString(body, 'pincode') ?? '';
    const username = readString(body, 'username')?.toLowerCase();
    const password = typeof body['password'] === 'string' ? body['password'] : '';
    const status = body['status'] === undefined ? 'Active' : body['status'];
    if (!name || !username || password.length < 12 || !validStatus(status) ||
        (email && !emailPattern.test(email))) {
        res.status(400).json({
            success: false,
            message: 'Enter a branch name, unique username, password of at least 12 characters, and valid contact details.'
        });
        return;
    }
    try {
        const customer = await Customer.findById(customerId);
        if (!customer) {
            res.status(404).json({ success: false, message: 'Customer not found.' });
            return;
        }
        const branch = await Branch.create({
            customerId,
            code: await nextCode('branch', 'BR'),
            name,
            phone,
            email,
            address,
            city,
            state,
            pincode,
            username,
            passwordHash: await hashPassword(password),
            status
        });
        const { passwordHash: _passwordHash, ...safeBranch } = branch.toObject();
        res.status(201).json({
            success: true,
            message: 'Branch created successfully.',
            branch: publicBranch(safeBranch)
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to create branch.');
    }
}
export async function getBranchById(req, res) {
    const { customerId, branchId } = req.params;
    if (!validId(customerId) || !validId(branchId)) {
        res.status(400).json({ success: false, message: 'Customer or branch ID is invalid.' });
        return;
    }
    try {
        const branch = await Branch.findOne({ _id: branchId, customerId }).lean();
        if (!branch) {
            res.status(404).json({ success: false, message: 'Branch not found.' });
            return;
        }
        const [openTickets, customer] = await Promise.all([
            Ticket.countDocuments({ branchId, status: { $nin: ['Resolved', 'Closed'] } }),
            Customer.findById(customerId).select('name').lean()
        ]);
        res.json({
            success: true,
            branch: { ...publicBranch(branch), openTickets, customer: customer?.name ?? '' }
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to load branch.');
    }
}
export async function updateBranch(req, res) {
    const { customerId, branchId } = req.params;
    const body = readBody(req.body);
    if (!validId(customerId) || !validId(branchId) || !body) {
        res.status(400).json({ success: false, message: 'Customer or branch details are invalid.' });
        return;
    }
    const update = {};
    for (const field of ['name', 'phone', 'email', 'address', 'city', 'state', 'pincode']) {
        const value = readString(body, field);
        if (value !== undefined)
            update[field] = value;
    }
    const username = readString(body, 'username');
    if (username !== undefined)
        update['username'] = username.toLowerCase();
    if (body['status'] !== undefined) {
        if (!validStatus(body['status'])) {
            res.status(400).json({ success: false, message: 'Branch status is invalid.' });
            return;
        }
        update['status'] = body['status'];
    }
    if (typeof body['password'] === 'string' && body['password']) {
        if (body['password'].length < 12) {
            res.status(400).json({ success: false, message: 'Password must be at least 12 characters.' });
            return;
        }
        update['passwordHash'] = await hashPassword(body['password']);
    }
    if (!Object.keys(update).length || update['name'] === '') {
        res.status(400).json({ success: false, message: 'Provide valid branch fields to update.' });
        return;
    }
    if (update['email'] && !emailPattern.test(update['email'])) {
        res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        return;
    }
    try {
        const branch = await Branch.findOneAndUpdate({ _id: branchId, customerId }, { $set: update }, { new: true, runValidators: true });
        if (!branch) {
            res.status(404).json({ success: false, message: 'Branch not found.' });
            return;
        }
        const { passwordHash: _passwordHash, ...safeBranch } = branch.toObject();
        res.json({ success: true, message: 'Branch updated successfully.', branch: publicBranch(safeBranch) });
    }
    catch (error) {
        handleError(res, error, 'Failed to update branch.');
    }
}
