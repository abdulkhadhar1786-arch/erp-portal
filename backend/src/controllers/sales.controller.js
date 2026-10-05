import mongoose from 'mongoose';
import { Branch } from '../models/Branch.js';
import { CodeCounter } from '../models/CodeCounter.js';
import { Customer } from '../models/Customer.js';
import { DeliveryRecord } from '../models/DeliveryRecord.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { StockDocument } from '../models/StockDocument.js';
import { SalesOrder, salesOrderStatuses } from '../models/SalesOrder.js';
import { SalesQuote, quoteStatuses } from '../models/SalesQuote.js';
import { defaultQuoteProfile, QuoteProfile } from '../models/QuoteProfile.js';
import { getRequestSession } from '../middleware/auth.js';
function readBody(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function readString(body, key) {
    return typeof body[key] === 'string' ? body[key].trim() : undefined;
}
function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
async function nextNumber(counterId, prefix) {
    const counter = await CodeCounter.findByIdAndUpdate(counterId, { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return `${prefix}-${String(counter?.sequence ?? 1).padStart(5, '0')}`;
}
function parseDate(value) {
    if (value === null || value === '')
        return null;
    if (typeof value !== 'string')
        return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}
function addressText(value) {
    const address = readBody(value);
    if (!address)
        return '';
    return ['building', 'street', 'area', 'city', 'state', 'pincode', 'country']
        .map((key) => readString(address, key) ?? '')
        .filter(Boolean)
        .join(', ');
}
const proposalDetailFields = {
    Sales: {
        text: ['paymentTerms', 'paymentMilestones', 'deliveryMethod', 'deliverySchedule', 'warrantyPeriod', 'returnPolicy'], dates: [], numbers: ['freightCharges']
    },
    Rental: {
        text: ['rentalBillingCycle', 'paymentTerms', 'rentalConditions', 'rentalUsageLimit', 'maintenanceResponsibility', 'damageLiability', 'returnConditions'],
        dates: ['rentalStartDate', 'rentalEndDate'], numbers: ['securityDeposit']
    },
    AMC: {
        text: ['coverageType', 'responseSla', 'resolutionSla', 'serviceWindow', 'preventiveMaintenanceFrequency', 'paymentTerms', 'exclusions'],
        dates: ['contractStartDate', 'contractEndDate'], numbers: ['preventiveVisitsPerYear']
    },
    MPS: {
        text: ['includedServices', 'mpsBillingFrequency', 'meterReadingProcess'], dates: [],
        numbers: ['monoRate', 'colorRate', 'minimumMonoPages', 'minimumColorPages', 'monoOverageRate', 'colorOverageRate']
    },
    ASP: {
        text: ['serviceScope', 'supportTiers', 'supportAvailability', 'vendorEscalationContact', 'pricingBasis', 'responseSla', 'escalationPath', 'operationalBoundaries'],
        dates: [], numbers: ['serviceRate', 'includedEngineerHours']
    },
    'Visit charge': {
        text: ['visitScope'], dates: ['visitDate'],
        numbers: ['visitFee', 'hourlyLaborRate', 'laborHours', 'includedLaborHours', 'travelCharges', 'travelDistanceKm', 'emergencyCharges']
    }
};
function normalizeProposalDetails(proposalType, value) {
    const source = value === undefined ? {} : readBody(value);
    if (!source)
        return null;
    const schema = proposalDetailFields[proposalType === 'Unit' ? 'Sales' : proposalType];
    if (!schema)
        return {};
    const details = {};
    for (const key of schema.text) {
        const text = readString(source, key) ?? (key === 'mpsBillingFrequency' ? 'Monthly' : '');
        if (text.length > 2000)
            return null;
        if (key === 'mpsBillingFrequency' && !['Monthly', 'Quarterly'].includes(text))
            return null;
        details[key] = text;
    }
    for (const key of schema.dates) {
        const value = source[key];
        if (value === undefined || value === '') {
            details[key] = '';
            continue;
        }
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
            return null;
        const date = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
            return null;
        details[key] = value;
    }
    for (const key of schema.numbers) {
        const raw = source[key];
        const number = raw === undefined || raw === '' ? 0 : Number(raw);
        if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000 ||
            ((key.endsWith('Pages') || key === 'preventiveVisitsPerYear') && !Number.isInteger(number)))
            return null;
        details[key] = number;
    }
    const start = details['rentalStartDate'] ?? details['contractStartDate'];
    const end = details['rentalEndDate'] ?? details['contractEndDate'];
    if (typeof start === 'string' && typeof end === 'string' && start && end && end < start)
        return null;
    return details;
}
function profileData(value) {
    return { ...defaultQuoteProfile, ...value };
}
async function readQuote(body) {
    const customerId = readString(body, 'customerId') ?? '';
    const branchId = readString(body, 'branchId') ?? '';
    const proposalType = readString(body, 'proposalType') ?? 'Sales';
    const proposalDetails = normalizeProposalDetails(proposalType, body['proposalDetails']);
    const warrantyType = readString(body, 'warrantyType') ?? 'Not Applicable';
    const warrantyFrom = readString(body, 'warrantyFrom') ?? 'Not Applicable';
    const installationBy = readString(body, 'installationBy') ?? 'Not Applicable';
    const preventiveMaintenance = readString(body, 'preventiveMaintenance') ?? 'Not Applicable';
    const discountRate = body['discountRate'] === undefined ? 0 : Number(body['discountRate']);
    const taxRate = body['taxRate'] === undefined ? 0 : Number(body['taxRate']);
    const validUntil = body['validUntil'] === undefined ? null : parseDate(body['validUntil']);
    const rawLines = body['lineItems'];
    if (!mongoose.isValidObjectId(customerId) || (branchId && !mongoose.isValidObjectId(branchId)) ||
        !proposalDetails ||
        !Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100 ||
        !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 ||
        validUntil === undefined || !Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > 100)
        return null;
    const customer = await Customer.findById(customerId)
        .select('name email phone status code contactPerson billingAddress shippingAddress gstin pan')
        .lean();
    if (!customer || customer.status !== 'Active')
        return null;
    const branch = branchId
        ? await Branch.findOne({ _id: branchId, customerId, status: 'Active' })
            .select('code name phone email address city state pincode')
            .lean()
        : null;
    if (branchId && !branch)
        return null;
    const profile = await QuoteProfile.findOne({ key: 'default' }).lean();
    const sellerSnapshot = profileData(profile);
    const branchAddress = branch
        ? [branch.address, branch.city, branch.state, branch.pincode].filter(Boolean).join(', ')
        : '';
    const inputLines = [];
    for (const rawLine of rawLines) {
        const line = readBody(rawLine);
        if (!line)
            return null;
        const inventoryItemId = readString(line, 'inventoryItemId') ?? '';
        const name = readString(line, 'name') ?? '';
        const quantity = Number(line['quantity']);
        const unitPrice = Number(line['unitPrice']);
        const brand = readString(line, 'brand') ?? '';
        const modelNumber = readString(line, 'modelNumber') ?? '';
        const specifications = readString(line, 'specifications') ?? '';
        const serialNumber = readString(line, 'serialNumber') ?? '';
        const condition = readString(line, 'condition') ?? '';
        const location = readString(line, 'location') ?? '';
        if ((inventoryItemId && !mongoose.isValidObjectId(inventoryItemId)) ||
            !name || name.length > 140 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 ||
            !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000_000 ||
            brand.length > 100 || modelNumber.length > 100 || specifications.length > 1000 ||
            serialNumber.length > 100 || condition.length > 80 || location.length > 160)
            return null;
        inputLines.push({
            inventoryItemId,
            name,
            sku: readString(line, 'sku') ?? '',
            hsnCode: readString(line, 'hsnCode') ?? '',
            description: readString(line, 'description') ?? '',
            unit: readString(line, 'unit') || 'unit',
            warranty: readString(line, 'warranty') || 'Not Applicable',
            brand,
            modelNumber,
            specifications,
            serialNumber,
            condition,
            location,
            quantity,
            unitPrice
        });
    }
    const catalogIds = [...new Set(inputLines.map(line => line.inventoryItemId).filter(Boolean))];
    const catalogItems = catalogIds.length
        ? await InventoryItem.find({ _id: { $in: catalogIds }, status: 'Active' }).select('sku name unit').lean()
        : [];
    const catalogById = new Map(catalogItems.map(item => [String(item._id), item]));
    const lineItems = [];
    for (const line of inputLines) {
        const catalogItem = line.inventoryItemId ? catalogById.get(line.inventoryItemId) : undefined;
        if (line.inventoryItemId && !catalogItem)
            return null;
        lineItems.push({
            inventoryItemId: line.inventoryItemId,
            sku: catalogItem?.sku ?? line.sku,
            hsnCode: line.hsnCode,
            name: catalogItem?.name ?? line.name,
            description: line.description,
            unit: catalogItem?.unit ?? line.unit,
            warranty: line.warranty,
            brand: line.brand,
            modelNumber: line.modelNumber,
            specifications: line.specifications,
            serialNumber: line.serialNumber,
            condition: line.condition,
            location: line.location,
            quantity: line.quantity,
            unitPrice: roundMoney(line.unitPrice),
            lineTotal: roundMoney(line.quantity * line.unitPrice)
        });
    }
    const subTotal = roundMoney(lineItems.reduce((total, line) => total + line.lineTotal, 0));
    const discountAmount = roundMoney(subTotal * discountRate / 100);
    const detailNumber = (key) => Number(proposalDetails[key]) || 0;
    const extraCharges = proposalType === 'Sales' || proposalType === 'Unit'
        ? detailNumber('freightCharges')
        : proposalType === 'MPS'
            ? (detailNumber('monoRate') * detailNumber('minimumMonoPages') + detailNumber('colorRate') * detailNumber('minimumColorPages')) *
                (proposalDetails['mpsBillingFrequency'] === 'Quarterly' ? 3 : 1)
            : proposalType === 'Visit charge'
                ? detailNumber('visitFee') + detailNumber('hourlyLaborRate') * Math.max(0, detailNumber('laborHours') - detailNumber('includedLaborHours')) +
                    detailNumber('travelCharges') + detailNumber('emergencyCharges')
                : 0;
    const taxableAmount = roundMoney(subTotal - discountAmount + extraCharges);
    const taxAmount = roundMoney(taxableAmount * taxRate / 100);
    const unroundedTotal = roundMoney(taxableAmount + taxAmount);
    const total = Math.round(unroundedTotal);
    return {
        customerId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        branchId: branch ? String(branch._id) : '',
        branchCode: branch?.code ?? '',
        branchName: branch?.name ?? '',
        branchAddress,
        branchCity: branch?.city ?? '',
        branchState: branch?.state ?? '',
        branchPincode: branch?.pincode ?? '',
        branchEmail: branch?.email ?? '',
        branchPhone: branch?.phone ?? '',
        customerBillingAddress: addressText(customer.billingAddress),
        customerShippingAddress: addressText(customer.shippingAddress),
        customerState: branch?.state || customer.billingAddress?.state || '',
        customerGstin: customer.gstin ?? '',
        customerPan: customer.pan ?? '',
        proposalType,
        proposalDetails,
        warrantyType,
        warrantyFrom,
        installationBy,
        preventiveMaintenance,
        lineItems,
        subTotal,
        discountRate: roundMoney(discountRate),
        discountAmount,
        taxRate: roundMoney(taxRate),
        taxAmount,
        roundOff: roundMoney(total - unroundedTotal),
        total,
        validUntil,
        notes: readString(body, 'notes') ?? '',
        termsAndConditions: readString(body, 'termsAndConditions') ?? sellerSnapshot.defaultTerms,
        sellerSnapshot
    };
}
function publicRecord(record) {
    return { ...record, _id: String(record._id) };
}
function handleError(res, error, message) {
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ success: false, message: 'Sales document details are invalid.' });
        return;
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        res.status(409).json({ success: false, message: 'A document with this number or source quote already exists.' });
        return;
    }
    console.error(message, error);
    res.status(500).json({ success: false, message });
}
export async function getQuotes(_req, res) {
    try {
        const quotes = await SalesQuote.find().sort({ updatedAt: -1 }).lean();
        res.json({ success: true, count: quotes.length, quotes: quotes.map(publicRecord) });
    }
    catch (error) {
        handleError(res, error, 'Failed to load quotes.');
    }
}
export async function getQuoteProfile(_req, res) {
    try {
        const profile = await QuoteProfile.findOne({ key: 'default' }).lean();
        res.json({ success: true, profile: profileData(profile) });
    }
    catch (error) {
        handleError(res, error, 'Failed to load quote profile.');
    }
}
export async function updateQuoteProfile(req, res) {
    const body = readBody(req.body);
    if (!body) {
        res.status(400).json({ success: false, message: 'Quote profile details are invalid.' });
        return;
    }
    const next = {};
    for (const key of Object.keys(defaultQuoteProfile)) {
        const value = body[key];
        if (key === 'defaultValidityDays') {
            const days = Number(value);
            if (!Number.isInteger(days) || days < 1 || days > 365) {
                res.status(400).json({ success: false, message: 'Default validity must be between 1 and 365 days.' });
                return;
            }
            next[key] = days;
        }
        else if (typeof value === 'string') {
            next[key] = value.trim();
        }
        else {
            res.status(400).json({ success: false, message: `Quote profile field ${key} must be text.` });
            return;
        }
    }
    try {
        const profile = await QuoteProfile.findOneAndUpdate({ key: 'default' }, { $set: next }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
        res.json({ success: true, profile: profileData(profile) });
    }
    catch (error) {
        handleError(res, error, 'Failed to save quote profile.');
    }
}
export async function createQuote(req, res) {
    const body = readBody(req.body);
    const details = body && await readQuote(body);
    if (!details) {
        res.status(400).json({ success: false, message: 'Choose an active customer and add valid quote line items.' });
        return;
    }
    try {
        const quote = await SalesQuote.create({
            quoteNumber: await nextNumber('sales-quote', 'QTE'),
            ...details,
            sellerSnapshot: { ...details.sellerSnapshot },
            status: 'Draft'
        });
        res.status(201).json({ success: true, quote: publicRecord(quote.toObject()) });
    }
    catch (error) {
        handleError(res, error, 'Failed to create quote.');
    }
}
export async function updateQuote(req, res) {
    const id = req.params['id'];
    const body = readBody(req.body);
    if (!id || !mongoose.isValidObjectId(id) || !body) {
        res.status(400).json({ success: false, message: 'Quote details are invalid.' });
        return;
    }
    try {
        const existing = await SalesQuote.findById(id).select('status').lean();
        if (!existing) {
            res.status(404).json({ success: false, message: 'Quote not found.' });
            return;
        }
        if (existing.status !== 'Draft') {
            res.status(409).json({ success: false, message: 'Only draft quotes can be edited.' });
            return;
        }
        const details = await readQuote(body);
        if (!details) {
            res.status(400).json({ success: false, message: 'Choose an active customer and add valid quote line items.' });
            return;
        }
        const quote = await SalesQuote.findByIdAndUpdate(id, details, { new: true, runValidators: true }).lean();
        if (!quote) {
            res.status(404).json({ success: false, message: 'Quote not found.' });
            return;
        }
        res.json({ success: true, quote: publicRecord(quote) });
    }
    catch (error) {
        handleError(res, error, 'Failed to update quote.');
    }
}
export async function updateQuoteStatus(req, res) {
    const id = req.params['id'];
    const status = readBody(req.body)?.['status'];
    if (!id || !mongoose.isValidObjectId(id) || typeof status !== 'string' || !quoteStatuses.includes(status)) {
        res.status(400).json({ success: false, message: 'Quote status is invalid.' });
        return;
    }
    try {
        const quote = await SalesQuote.findById(id);
        if (!quote) {
            res.status(404).json({ success: false, message: 'Quote not found.' });
            return;
        }
        const allowed = {
            Draft: ['Sent'], Sent: ['Accepted', 'Rejected', 'Expired'],
            Accepted: [], Rejected: [], Expired: []
        };
        if (quote.status !== status && !allowed[quote.status].includes(status)) {
            res.status(409).json({ success: false, message: `A quote cannot move from ${quote.status} to ${status}.` });
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const validUntil = quote.validUntil?.toISOString().slice(0, 10);
        if (status === 'Sent' && (!validUntil || validUntil < today)) {
            res.status(409).json({ success: false, message: 'Set a future valid-until date before sending this quote.' });
            return;
        }
        if (status === 'Accepted' && validUntil && validUntil < today) {
            res.status(409).json({ success: false, message: 'This quote has expired and must be renewed before acceptance.' });
            return;
        }
        if (status === 'Expired' && (!validUntil || validUntil >= today)) {
            res.status(409).json({ success: false, message: 'Only a quote past its validity date can be marked expired.' });
            return;
        }
        quote.status = status;
        await quote.save();
        res.json({ success: true, quote: publicRecord(quote.toObject()) });
    }
    catch (error) {
        handleError(res, error, 'Failed to update quote status.');
    }
}
export async function renewQuote(req, res) {
    const id = req.params['id'];
    const body = readBody(req.body);
    const validUntil = body ? parseDate(body['validUntil']) : undefined;
    const today = new Date().toISOString().slice(0, 10);
    if (!id || !mongoose.isValidObjectId(id) || !(validUntil instanceof Date) || validUntil.toISOString().slice(0, 10) <= today) {
        res.status(400).json({ success: false, message: 'Choose a valid future expiry date.' });
        return;
    }
    try {
        const quote = await SalesQuote.findOneAndUpdate({ _id: id, status: 'Expired' }, { $set: { validUntil, status: 'Sent' } }, { new: true, runValidators: true }).lean();
        if (!quote) {
            const exists = await SalesQuote.exists({ _id: id });
            res.status(exists ? 409 : 404).json({
                success: false,
                message: exists ? 'Only expired quotes can be renewed.' : 'Quote not found.'
            });
            return;
        }
        res.json({ success: true, quote: publicRecord(quote) });
    }
    catch (error) {
        handleError(res, error, 'Failed to renew quote.');
    }
}
export async function convertQuoteToOrder(req, res) {
    const id = req.params['id'];
    if (!id || !mongoose.isValidObjectId(id)) {
        res.status(400).json({ success: false, message: 'Quote ID is invalid.' });
        return;
    }
    try {
        const existingOrder = await SalesOrder.findOne({ quoteId: id }).lean();
        if (existingOrder) {
            res.json({ success: true, alreadyConverted: true, order: publicRecord(existingOrder) });
            return;
        }
        const quote = await SalesQuote.findById(id).lean();
        if (!quote) {
            res.status(404).json({ success: false, message: 'Quote not found.' });
            return;
        }
        if (quote.status !== 'Accepted') {
            res.status(409).json({ success: false, message: 'Only accepted quotes can be converted to a sales order.' });
            return;
        }
        const order = await SalesOrder.create({
            orderNumber: await nextNumber('sales-order', 'SO'),
            quoteId: quote._id,
            quoteNumber: quote.quoteNumber,
            proposalType: quote.proposalType ?? 'Sales',
            proposalDetails: quote.proposalDetails ?? {},
            customerId: quote.customerId,
            customerName: quote.customerName,
            customerEmail: quote.customerEmail,
            customerPhone: quote.customerPhone,
            branchId: quote.branchId ?? '',
            branchCode: quote.branchCode ?? '',
            branchName: quote.branchName ?? '',
            branchAddress: quote.branchAddress ?? '',
            branchCity: quote.branchCity ?? '',
            branchState: quote.branchState ?? '',
            branchPincode: quote.branchPincode ?? '',
            branchEmail: quote.branchEmail ?? '',
            branchPhone: quote.branchPhone ?? '',
            customerBillingAddress: quote.customerBillingAddress ?? '',
            customerShippingAddress: quote.customerShippingAddress ?? '',
            customerState: quote.customerState ?? '',
            customerGstin: quote.customerGstin ?? '',
            customerPan: quote.customerPan ?? '',
            sellerSnapshot: quote.sellerSnapshot ?? {},
            lineItems: quote.lineItems,
            subTotal: quote.subTotal,
            discountRate: quote.discountRate ?? 0,
            discountAmount: quote.discountAmount ?? 0,
            taxRate: quote.taxRate,
            taxAmount: quote.taxAmount,
            roundOff: quote.roundOff ?? 0,
            total: quote.total,
            orderDate: new Date(),
            notes: quote.notes,
            termsAndConditions: quote.termsAndConditions ?? '',
            status: 'Confirmed'
        });
        res.status(201).json({ success: true, alreadyConverted: false, order: publicRecord(order.toObject()) });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            try {
                const order = await SalesOrder.findOne({ quoteId: id }).lean();
                if (order) {
                    res.json({ success: true, alreadyConverted: true, order: publicRecord(order) });
                    return;
                }
            }
            catch { /* The original error handler reports the duplicate if the order cannot be read. */ }
        }
        handleError(res, error, 'Failed to convert quote to sales order.');
    }
}
export async function getSalesOrders(_req, res) {
    try {
        const orders = await SalesOrder.find().sort({ orderDate: -1 }).lean();
        res.json({ success: true, count: orders.length, orders: orders.map(publicRecord) });
    }
    catch (error) {
        handleError(res, error, 'Failed to load sales orders.');
    }
}
export async function getSalesOrderFulfillmentOptions(req, res) {
    const rawId = req.params['id'];
    const id = typeof rawId === 'string' ? rawId : '';
    if (!mongoose.isValidObjectId(id)) {
        res.status(400).json({ success: false, message: 'Sales order ID is invalid.' });
        return;
    }
    try {
        const order = await SalesOrder.findById(id).lean();
        if (!order) {
            res.status(404).json({ success: false, message: 'Sales order not found.' });
            return;
        }
        if (order.status !== 'Processing' && order.status !== 'Partially Fulfilled') {
            res.status(409).json({ success: false, message: `Only processing orders can be dispatched. Current status: ${order.status}.` });
            return;
        }
        const orderedItems = new Map();
        for (const line of order.lineItems) {
            if (!line.inventoryItemId)
                continue;
            const current = orderedItems.get(line.inventoryItemId) ?? { sku: line.sku, name: line.name, unit: line.unit, quantity: 0 };
            current.quantity += line.quantity;
            orderedItems.set(line.inventoryItemId, current);
        }
        const itemIds = [...orderedItems.keys()];
        const validItemIds = itemIds.filter(mongoose.isValidObjectId);
        const [documents, inventoryItems] = await Promise.all([
            StockDocument.find({ salesOrderId: id, type: 'Delivery Challan' }).sort({ createdAt: 1 }).lean(),
            validItemIds.length ? InventoryItem.find({ _id: { $in: validItemIds } }).lean() : Promise.resolve([])
        ]);
        const issuedByItem = new Map();
        for (const document of documents)
            for (const line of document.lines) {
                if (line.direction === 'Out')
                    issuedByItem.set(line.inventoryItemId, (issuedByItem.get(line.inventoryItemId) ?? 0) + line.quantity);
            }
        const inventoryById = new Map(inventoryItems.map(item => [String(item._id), item]));
        const items = itemIds.map(inventoryItemId => {
            const ordered = orderedItems.get(inventoryItemId);
            const inventoryItem = inventoryById.get(inventoryItemId);
            const issuedQuantity = issuedByItem.get(inventoryItemId) ?? 0;
            return {
                inventoryItemId,
                sku: inventoryItem?.sku ?? ordered.sku,
                name: inventoryItem?.name ?? ordered.name,
                unit: inventoryItem?.unit ?? ordered.unit,
                orderedQuantity: ordered.quantity,
                issuedQuantity,
                remainingQuantity: Math.max(0, Number((ordered.quantity - issuedQuantity).toFixed(6))),
                availableQuantity: inventoryItem?.status === 'Active' ? Math.max(0, inventoryItem.quantityOnHand) : 0,
                active: inventoryItem?.status === 'Active'
            };
        });
        res.json({
            success: true,
            orderId: id,
            items,
            documents: documents.map(document => ({ _id: String(document._id), documentNumber: document.documentNumber, createdAt: document.createdAt }))
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to load available order quantities.');
    }
}
export async function updateSalesOrderStatus(req, res) {
    const id = req.params['id'];
    const status = readBody(req.body)?.['status'];
    if (!id || !mongoose.isValidObjectId(id) || typeof status !== 'string' || !salesOrderStatuses.includes(status)) {
        res.status(400).json({ success: false, message: 'Sales order status is invalid.' });
        return;
    }
    try {
        const order = await SalesOrder.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: 'Sales order not found.' });
            return;
        }
        const allowed = {
            Confirmed: ['Processing', 'Cancelled'],
            Processing: ['Cancelled'],
            'Partially Fulfilled': [],
            Fulfilling: [],
            Fulfilled: [],
            Cancelled: []
        };
        if (order.status !== status && !allowed[order.status].includes(status)) {
            res.status(409).json({ success: false, message: `A sales order cannot move from ${order.status} to ${status}.` });
            return;
        }
        order.status = status;
        await order.save();
        res.json({ success: true, order: publicRecord(order.toObject()) });
    }
    catch (error) {
        handleError(res, error, 'Failed to update sales order status.');
    }
}
export async function fulfillSalesOrder(req, res) {
    const rawId = req.params['id'];
    const id = typeof rawId === 'string' ? rawId : '';
    if (!mongoose.isValidObjectId(id)) {
        res.status(400).json({ success: false, message: 'Sales order ID is invalid.' });
        return;
    }
    const rawLines = readBody(req.body)?.['lines'];
    if (!Array.isArray(rawLines)) {
        res.status(400).json({ success: false, message: 'Choose the item quantities for this delivery challan.' });
        return;
    }
    const selectedQuantities = new Map();
    for (const rawLine of rawLines) {
        const line = readBody(rawLine);
        const inventoryItemId = line && readString(line, 'inventoryItemId');
        const quantity = line?.['quantity'];
        if (!inventoryItemId || !mongoose.isValidObjectId(inventoryItemId) || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
            res.status(400).json({ success: false, message: 'Each selected item needs a valid inventory item and a quantity greater than zero.' });
            return;
        }
        selectedQuantities.set(inventoryItemId, (selectedQuantities.get(inventoryItemId) ?? 0) + quantity);
    }
    let order = null;
    let stockDocumentId = '';
    let deliveryRecordId = '';
    const stockChanges = [];
    let failureStatus = 500;
    let failureMessage = 'Failed to create delivery challan.';
    try {
        order = await SalesOrder.findOneAndUpdate({ _id: id, status: { $in: ['Processing', 'Partially Fulfilled'] } }, { $set: { status: 'Fulfilling' } }, { new: false });
        if (!order) {
            const current = await SalesOrder.findById(id).lean();
            if (!current) {
                res.status(404).json({ success: false, message: 'Sales order not found.' });
                return;
            }
            if (current.status === 'Fulfilled') {
                const document = current.fulfillmentDocumentId ? await StockDocument.findById(current.fulfillmentDocumentId).lean() : null;
                const delivery = document ? await DeliveryRecord.findOne({ stockDocumentId: String(document._id) }).lean() : null;
                res.json({ success: true, alreadyFulfilled: true, order: publicRecord(current), stockDocument: document, delivery });
                return;
            }
            res.status(409).json({ success: false, message: `Only processing or partially fulfilled orders can be dispatched. Current status: ${current.status}.` });
            return;
        }
        const quantities = new Map();
        for (const line of order.lineItems) {
            if (line.inventoryItemId)
                quantities.set(line.inventoryItemId, (quantities.get(line.inventoryItemId) ?? 0) + line.quantity);
        }
        const unknownSelection = [...selectedQuantities.keys()].find(itemId => !quantities.has(itemId));
        if (unknownSelection) {
            failureStatus = 400;
            failureMessage = 'The selection includes an item that is not part of this sales order.';
            throw new Error(failureMessage);
        }
        const previousDocuments = await StockDocument.find({ salesOrderId: id, type: 'Delivery Challan' }).select('lines').lean();
        const issuedQuantities = new Map();
        for (const document of previousDocuments)
            for (const line of document.lines) {
                if (line.direction === 'Out')
                    issuedQuantities.set(line.inventoryItemId, (issuedQuantities.get(line.inventoryItemId) ?? 0) + line.quantity);
            }
        for (const [inventoryItemId, quantity] of selectedQuantities) {
            const remaining = Math.max(0, quantities.get(inventoryItemId) - (issuedQuantities.get(inventoryItemId) ?? 0));
            if (quantity > remaining + 0.000001) {
                failureStatus = 409;
                failureMessage = 'A selected quantity exceeds the remaining quantity on the sales order. Refresh the item availability and try again.';
                throw new Error(failureMessage);
            }
        }
        const remainingBeforeDispatch = [...quantities].some(([inventoryItemId, ordered]) => ordered - (issuedQuantities.get(inventoryItemId) ?? 0) > 0.000001);
        if (remainingBeforeDispatch && !selectedQuantities.size) {
            failureStatus = 400;
            failureMessage = 'Select at least one item quantity for this delivery challan.';
            throw new Error(failureMessage);
        }
        const selectedIds = [...selectedQuantities.keys()];
        const items = selectedIds.length
            ? await InventoryItem.find({ _id: { $in: selectedIds }, status: 'Active' }).lean()
            : [];
        if (items.length !== selectedIds.length) {
            failureStatus = 409;
            failureMessage = 'A selected item is no longer active in inventory. Refresh availability and try again.';
            throw new Error(failureMessage);
        }
        const itemById = new Map(items.map(item => [String(item._id), item]));
        const lines = selectedIds.map(inventoryItemId => {
            const item = itemById.get(inventoryItemId);
            return {
                inventoryItemId,
                sku: item.sku,
                itemName: item.name,
                unit: item.unit,
                quantity: selectedQuantities.get(inventoryItemId),
                direction: 'Out',
                unitCost: item.unitCost
            };
        });
        for (const line of lines) {
            const updated = await InventoryItem.findOneAndUpdate({ _id: line.inventoryItemId, status: 'Active', quantityOnHand: { $gte: line.quantity } }, { $inc: { quantityOnHand: -line.quantity } }, { new: true });
            if (!updated) {
                failureStatus = 409;
                failureMessage = `Insufficient stock for ${line.sku}; fulfillment was not completed.`;
                throw new Error(failureMessage);
            }
            stockChanges.push({ inventoryItemId: line.inventoryItemId, quantity: line.quantity });
        }
        let documentNumber = '';
        if (lines.length) {
            documentNumber = await nextNumber('delivery-challan', 'DC');
            const document = await StockDocument.create({
                documentNumber,
                type: 'Delivery Challan',
                partyName: order.customerName,
                salesOrderId: String(order._id),
                salesOrderNumber: order.orderNumber,
                reference: order.orderNumber,
                notes: `Dispatch against ${order.orderNumber}. Remaining quantities may be issued on a later challan.`,
                lines,
                createdBy: getRequestSession(req)?.sub ?? 'Administrator',
                postedAt: new Date()
            });
            stockDocumentId = String(document._id);
            const delivery = await DeliveryRecord.create({
                deliveryNumber: documentNumber,
                stockDocumentId,
                challanNumber: documentNumber,
                salesOrderId: String(order._id),
                salesOrderNumber: order.orderNumber,
                customerName: order.customerName,
                recipient: '',
                carrier: '',
                trackingNumber: '',
                status: 'Prepared',
                deliveredAt: null,
                createdBy: getRequestSession(req)?.sub ?? 'Administrator'
            });
            deliveryRecordId = String(delivery._id);
        }
        const orderComplete = [...quantities].every(([inventoryItemId, ordered]) => (issuedQuantities.get(inventoryItemId) ?? 0) + (selectedQuantities.get(inventoryItemId) ?? 0) >= ordered - 0.000001);
        const fulfillmentStatus = orderComplete ? 'Fulfilled' : 'Partially Fulfilled';
        const fulfilled = await SalesOrder.findOneAndUpdate({ _id: id, status: 'Fulfilling' }, { $set: {
                status: fulfillmentStatus,
                fulfillmentDocumentId: stockDocumentId || order.fulfillmentDocumentId,
                fulfillmentDocumentNumber: documentNumber || order.fulfillmentDocumentNumber
            } }, { new: true }).lean();
        if (!fulfilled)
            throw new Error('The order changed while fulfillment was being posted.');
        const stockDocument = stockDocumentId ? await StockDocument.findById(stockDocumentId).lean() : null;
        const delivery = deliveryRecordId ? await DeliveryRecord.findById(deliveryRecordId).lean() : null;
        res.json({ success: true, alreadyFulfilled: false, order: publicRecord(fulfilled), stockDocument, delivery });
    }
    catch (error) {
        if (deliveryRecordId)
            await DeliveryRecord.deleteOne({ _id: deliveryRecordId }).catch(() => undefined);
        if (stockDocumentId)
            await StockDocument.deleteOne({ _id: stockDocumentId }).catch(() => undefined);
        for (const change of stockChanges) {
            await InventoryItem.updateOne({ _id: change.inventoryItemId }, { $inc: { quantityOnHand: change.quantity } }).catch(() => undefined);
        }
        if (order)
            await SalesOrder.updateOne({ _id: id, status: 'Fulfilling' }, { $set: { status: order.status } }).catch(() => undefined);
        if (failureStatus === 500)
            console.error('Fulfill sales order error:', error);
        res.status(failureStatus).json({ success: false, message: failureMessage });
    }
}
