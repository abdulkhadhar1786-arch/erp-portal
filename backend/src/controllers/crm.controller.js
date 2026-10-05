import mongoose from 'mongoose';
import { CodeCounter } from '../models/CodeCounter.js';
import { Customer } from '../models/Customer.js';
import { Lead, leadSources, leadStages } from '../models/Lead.js';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function readBody(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function readString(body, key) {
    return typeof body[key] === 'string' ? body[key].trim() : undefined;
}
function validId(value) {
    return typeof value === 'string' && mongoose.isValidObjectId(value);
}
function parseDate(value) {
    if (value === null || value === '')
        return null;
    if (typeof value !== 'string')
        return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}
async function nextLeadNumber() {
    const counter = await CodeCounter.findByIdAndUpdate('crm-lead', { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return `LEAD-${String(counter?.sequence ?? 1).padStart(4, '0')}`;
}
async function nextCustomerCode() {
    const counter = await CodeCounter.findByIdAndUpdate('customer', { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return `CUS-${String(counter?.sequence ?? 1).padStart(4, '0')}`;
}
function handleError(res, error, message) {
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ success: false, message: 'Lead details are invalid.' });
        return;
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        res.status(409).json({ success: false, message: 'That lead number is already in use.' });
        return;
    }
    console.error(message, error);
    res.status(500).json({ success: false, message });
}
function readLead(body) {
    const companyName = readString(body, 'companyName') ?? '';
    const email = (readString(body, 'email') ?? '').toLowerCase();
    const source = body['source'] ?? 'Other';
    const stage = body['stage'] ?? 'New';
    const expectedValue = body['expectedValue'] === undefined ? 0 : Number(body['expectedValue']);
    const defaultProbability = { New: 10, Qualified: 25, Proposal: 50, Negotiation: 75, Won: 100, Lost: 0 };
    const probability = body['probability'] === undefined ? defaultProbability[stage] : Number(body['probability']);
    const targetCloseDate = body['targetCloseDate'] === undefined ? null : parseDate(body['targetCloseDate']);
    const nextFollowUp = body['nextFollowUp'] === undefined ? null : parseDate(body['nextFollowUp']);
    if (!companyName || companyName.length > 120 ||
        (email !== '' && !emailPattern.test(email)) ||
        typeof source !== 'string' || !leadSources.includes(source) ||
        typeof stage !== 'string' || !leadStages.includes(stage) ||
        !Number.isFinite(expectedValue) || expectedValue < 0 || expectedValue > 1_000_000_000_000 ||
        !Number.isFinite(probability) || probability < 0 || probability > 100 ||
        nextFollowUp === undefined || targetCloseDate === undefined)
        return null;
    return {
        companyName,
        contactName: readString(body, 'contactName') ?? '',
        contactTitle: readString(body, 'contactTitle') ?? '',
        email,
        phone: readString(body, 'phone') ?? '',
        industry: readString(body, 'industry') ?? '',
        source: source,
        stage: stage,
        expectedValue,
        probability,
        targetCloseDate,
        campaign: readString(body, 'campaign') ?? '',
        competitor: readString(body, 'competitor') ?? '',
        lostReason: readString(body, 'lostReason') ?? '',
        owner: readString(body, 'owner') ?? '',
        nextFollowUp,
        notes: readString(body, 'notes') ?? ''
    };
}
export async function getLeads(_req, res) {
    try {
        const leads = await Lead.find().sort({ updatedAt: -1, companyName: 1 }).lean();
        res.json({
            success: true,
            count: leads.length,
            leads: leads.map(lead => ({ ...lead, _id: String(lead._id) }))
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to load CRM leads.');
    }
}
export async function createLead(req, res) {
    const body = readBody(req.body);
    const details = body && readLead(body);
    if (!details) {
        res.status(400).json({ success: false, message: 'Enter a company, valid contact details, a pipeline stage, and a non-negative opportunity value.' });
        return;
    }
    try {
        const lead = await Lead.create({ leadNumber: await nextLeadNumber(), ...details });
        res.status(201).json({ success: true, lead: { ...lead.toObject(), _id: String(lead._id) } });
    }
    catch (error) {
        handleError(res, error, 'Failed to create CRM lead.');
    }
}
export async function updateLead(req, res) {
    const id = req.params['id'];
    const body = readBody(req.body);
    const details = body && readLead(body);
    if (!validId(id) || !details) {
        res.status(400).json({ success: false, message: 'Lead details are invalid.' });
        return;
    }
    try {
        const lead = await Lead.findByIdAndUpdate(id, details, { new: true, runValidators: true }).lean();
        if (!lead) {
            res.status(404).json({ success: false, message: 'Lead not found.' });
            return;
        }
        res.json({ success: true, lead: { ...lead, _id: String(lead._id) } });
    }
    catch (error) {
        handleError(res, error, 'Failed to update CRM lead.');
    }
}
export async function convertLeadToCustomer(req, res) {
    const id = req.params['id'];
    if (!validId(id)) {
        res.status(400).json({ success: false, message: 'Lead ID is invalid.' });
        return;
    }
    try {
        const lead = await Lead.findById(id);
        if (!lead) {
            res.status(404).json({ success: false, message: 'Lead not found.' });
            return;
        }
        if (lead.stage !== 'Won') {
            res.status(409).json({ success: false, message: 'Only won opportunities can be converted into customer accounts.' });
            return;
        }
        if (lead.customerId) {
            const linked = await Customer.findById(lead.customerId).lean();
            if (linked) {
                res.json({ success: true, alreadyConverted: true, lead: { ...lead.toObject(), _id: String(lead._id) }, customer: { ...linked, _id: String(linked._id) } });
                return;
            }
        }
        const bySource = await Customer.findOne({ sourceLeadId: id }).lean();
        const existing = bySource ?? (lead.email ? await Customer.findOne({ email: lead.email }).lean() : null);
        const customer = existing ?? await Customer.create({
            code: await nextCustomerCode(),
            name: lead.companyName,
            email: lead.email,
            phone: lead.phone,
            contactPerson: lead.contactName,
            designation: lead.contactTitle,
            industry: lead.industry,
            accountManager: lead.owner,
            website: '',
            internalNotes: `Created from won opportunity ${lead.leadNumber}.${lead.notes ? ` ${lead.notes}` : ''}`,
            address: '',
            city: '',
            status: 'Active',
            sourceLeadId: id
        });
        lead.customerId = String(customer._id);
        await lead.save();
        res.status(existing ? 200 : 201).json({
            success: true,
            alreadyConverted: !!existing,
            lead: { ...lead.toObject(), _id: String(lead._id) },
            customer: { ...customer.toObject(), _id: String(customer._id) }
        });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            const customer = await Customer.findOne({ sourceLeadId: id }).lean().catch(() => null);
            if (customer) {
                const lead = await Lead.findByIdAndUpdate(id, { $set: { customerId: String(customer._id) } }, { new: true }).lean();
                res.json({ success: true, alreadyConverted: true, lead: lead && { ...lead, _id: String(lead._id) }, customer: { ...customer, _id: String(customer._id) } });
                return;
            }
        }
        handleError(res, error, 'Failed to convert won opportunity into a customer.');
    }
}
