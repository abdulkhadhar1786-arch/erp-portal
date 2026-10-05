import mongoose from 'mongoose';
import { AssetRecord } from '../models/AssetRecord.js';
import { BundleProduct } from '../models/BundleProduct.js';
import { CodeCounter } from '../models/CodeCounter.js';
import { Customer } from '../models/Customer.js';
import { DeliveryRecord } from '../models/DeliveryRecord.js';
import { ExpenseVoucher } from '../models/ExpenseVoucher.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { SalesInvoice } from '../models/SalesInvoice.js';
import { SalesOrder } from '../models/SalesOrder.js';
import { StockDocument } from '../models/StockDocument.js';
import { getRequestSession } from '../middleware/auth.js';
function readBody(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function readString(body, key) {
    return typeof body[key] === 'string' ? body[key].trim() : '';
}
function readNumber(value, minimum = 0) {
    if (typeof value === 'string' && value.trim() === '')
        return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= minimum && number <= 1_000_000_000 ? number : null;
}
function readDate(value) {
    if (value === undefined || value === null || value === '')
        return null;
    if (typeof value !== 'string')
        return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}
function routeId(req) {
    const value = req.params['id'];
    return typeof value === 'string' ? value : '';
}
function validId(value) { return mongoose.isValidObjectId(value); }
async function nextNumber(counterId, prefix) {
    const counter = await CodeCounter.findByIdAndUpdate(counterId, { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return `${prefix}-${String(counter?.sequence ?? 1).padStart(5, '0')}`;
}
async function restoreMovements(changes) {
    for (const change of changes.reverse()) {
        await InventoryItem.updateOne({ _id: change.id }, { $inc: { quantityOnHand: -change.delta } }).catch(() => undefined);
    }
}
export async function getStockDocuments(_req, res) {
    try {
        const documents = await StockDocument.find().sort({ postedAt: -1 }).lean();
        res.json({ success: true, count: documents.length, documents });
    }
    catch (error) {
        console.error('Get stock documents error:', error);
        res.status(500).json({ success: false, message: 'Failed to load stock documents.' });
    }
}
export async function createStockDocument(req, res) {
    const body = readBody(req.body);
    const types = ['Inventory Adjustment'];
    const type = body?.['type'];
    const rawLines = body?.['lines'];
    if (!body || typeof type !== 'string' || !types.includes(type) || !Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > 100) {
        res.status(400).json({ success: false, message: 'Choose a stock document type and add between 1 and 100 item lines.' });
        return;
    }
    const seen = new Set();
    const inputLines = [];
    for (const rawLine of rawLines) {
        const line = readBody(rawLine);
        const inventoryItemId = line ? readString(line, 'inventoryItemId') : '';
        const quantity = line ? readNumber(line['quantity'], 0.01) : null;
        const direction = line?.['direction'] === 'In' ? 'In' : 'Out';
        if (!line || !validId(inventoryItemId) || quantity === null || (type === 'Inventory Adjustment' && line['direction'] !== 'In' && line['direction'] !== 'Out')) {
            res.status(400).json({ success: false, message: 'Check each item, quantity and inventory adjustment direction.' });
            return;
        }
        if (seen.has(inventoryItemId)) {
            res.status(400).json({ success: false, message: 'Use one line per SKU in each stock document.' });
            return;
        }
        seen.add(inventoryItemId);
        inputLines.push({ inventoryItemId, quantity, direction });
    }
    const partyName = readString(body, 'partyName');
    const reference = readString(body, 'reference');
    const notes = readString(body, 'notes');
    if (partyName.length > 160 || reference.length > 120 || notes.length > 1000) {
        res.status(400).json({ success: false, message: 'Party, reference or notes exceed the allowed length.' });
        return;
    }
    const changes = [];
    try {
        const itemRecords = await Promise.all(inputLines.map(line => InventoryItem.findOne({ _id: line.inventoryItemId, status: 'Active' }).lean()));
        if (itemRecords.some(item => !item)) {
            res.status(400).json({ success: false, message: 'One or more inventory items are inactive or missing.' });
            return;
        }
        const lines = inputLines.map((line, index) => {
            const item = itemRecords[index];
            return {
                inventoryItemId: String(item._id), sku: item.sku, itemName: item.name, unit: item.unit,
                quantity: line.quantity, direction: line.direction, unitCost: item.unitCost
            };
        });
        const prefix = 'ADJ';
        const documentNumber = await nextNumber(`stock-${prefix.toLowerCase()}`, prefix);
        for (const line of lines) {
            const delta = line.direction === 'In' ? line.quantity : -line.quantity;
            const filter = { _id: line.inventoryItemId, status: 'Active' };
            if (delta < 0)
                filter['quantityOnHand'] = { $gte: line.quantity };
            const updated = await InventoryItem.findOneAndUpdate(filter, { $inc: { quantityOnHand: delta } }, { new: true });
            if (!updated) {
                await restoreMovements(changes);
                res.status(409).json({ success: false, message: `Insufficient stock for ${line.sku}. No document was posted.` });
                return;
            }
            changes.push({ id: line.inventoryItemId, delta });
        }
        const document = await StockDocument.create({
            documentNumber,
            type: type,
            partyName,
            reference,
            notes,
            lines,
            createdBy: getRequestSession(req)?.sub ?? 'Administrator',
            postedAt: new Date()
        });
        res.status(201).json({ success: true, document });
    }
    catch (error) {
        await restoreMovements(changes);
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            res.status(409).json({ success: false, message: 'A duplicate stock document number was generated. Retry the post.' });
            return;
        }
        console.error('Create stock document error:', error);
        res.status(500).json({ success: false, message: 'Failed to post stock document. Applied stock changes were reversed.' });
    }
}
export async function getDeliveries(_req, res) {
    try {
        const deliveries = await DeliveryRecord.find().sort({ createdAt: -1 }).lean();
        res.json({ success: true, count: deliveries.length, deliveries });
    }
    catch (error) {
        console.error('Get deliveries error:', error);
        res.status(500).json({ success: false, message: 'Failed to load delivery challans.' });
    }
}
export async function updateDelivery(req, res) {
    const id = routeId(req);
    const body = readBody(req.body);
    const status = body?.['status'];
    const validStatuses = ['In Transit', 'Delivered', 'Failed', 'Returned'];
    const shippingFields = ['recipient', 'carrier', 'trackingNumber'];
    const hasShippingUpdate = !!body && shippingFields.some(field => Object.prototype.hasOwnProperty.call(body, field));
    const invalidShipping = !!body && shippingFields.some(field => Object.prototype.hasOwnProperty.call(body, field) &&
        (typeof body[field] !== 'string' || body[field].trim().length > 120));
    if (!validId(id) || !body || (status !== undefined && (typeof status !== 'string' || !validStatuses.includes(status))) ||
        invalidShipping || (status === undefined && !hasShippingUpdate)) {
        res.status(400).json({ success: false, message: 'Delivery status or shipment details are invalid.' });
        return;
    }
    try {
        const delivery = await DeliveryRecord.findById(id);
        if (!delivery) {
            res.status(404).json({ success: false, message: 'Delivery challan not found.' });
            return;
        }
        const transitions = {
            Prepared: ['In Transit', 'Failed'], 'In Transit': ['Delivered', 'Failed', 'Returned'],
            Delivered: [], Failed: ['In Transit', 'Returned'], Returned: []
        };
        if (typeof status === 'string' && !transitions[delivery.status].includes(status)) {
            res.status(409).json({ success: false, message: `A delivery cannot move from ${delivery.status} to ${status}.` });
            return;
        }
        if (typeof status === 'string')
            delivery.status = status;
        if (status === 'Delivered')
            delivery.deliveredAt = new Date();
        if (Object.prototype.hasOwnProperty.call(body, 'recipient'))
            delivery.recipient = body['recipient'].trim();
        if (Object.prototype.hasOwnProperty.call(body, 'carrier'))
            delivery.carrier = body['carrier'].trim();
        if (Object.prototype.hasOwnProperty.call(body, 'trackingNumber'))
            delivery.trackingNumber = body['trackingNumber'].trim();
        await delivery.save();
        res.json({ success: true, delivery });
    }
    catch (error) {
        console.error('Update delivery error:', error);
        res.status(500).json({ success: false, message: 'Failed to update delivery challan.' });
    }
}
function parseAsset(body) {
    const assetTag = readString(body, 'assetTag').toUpperCase();
    const serialNumber = readString(body, 'serialNumber').toUpperCase();
    const name = readString(body, 'name');
    const deviceType = readString(body, 'deviceType');
    const status = body['status'] ?? 'Active';
    const purchaseDate = readDate(body['purchaseDate']);
    const warrantyStart = readDate(body['warrantyStart']);
    const warrantyEnd = readDate(body['warrantyEnd']);
    const customerId = readString(body, 'customerId');
    const branchName = readString(body, 'branchName');
    const supplier = readString(body, 'supplier');
    const notes = readString(body, 'notes');
    if (!assetTag || assetTag.length > 40 || !serialNumber || serialNumber.length > 100 || !name || name.length > 160 || !deviceType || deviceType.length > 80 ||
        !['Active', 'In Repair', 'Retired'].includes(String(status)) || purchaseDate === undefined || warrantyStart === undefined || warrantyEnd === undefined ||
        (customerId && !validId(customerId)) || branchName.length > 160 || supplier.length > 160 || notes.length > 1000 ||
        (warrantyStart && warrantyEnd && warrantyEnd < warrantyStart))
        return null;
    return { assetTag, serialNumber, name, deviceType, status: status, customerId, branchName, supplier, purchaseDate, warrantyStart, warrantyEnd, notes };
}
async function customerNameFor(id) {
    if (!id)
        return '';
    if (!validId(id))
        return null;
    const customer = await Customer.findOne({ _id: id, status: 'Active' }).select('name').lean();
    return customer?.name ?? null;
}
export async function getAssets(_req, res) {
    try {
        const assets = await AssetRecord.find().sort({ updatedAt: -1 }).lean();
        res.json({ success: true, count: assets.length, assets });
    }
    catch (error) {
        console.error('Get assets error:', error);
        res.status(500).json({ success: false, message: 'Failed to load asset register.' });
    }
}
export async function createAsset(req, res) {
    const body = readBody(req.body);
    const details = body && parseAsset(body);
    if (!details) {
        res.status(400).json({ success: false, message: 'Asset details or warranty dates are invalid.' });
        return;
    }
    try {
        const customerName = await customerNameFor(details.customerId);
        if (customerName === null) {
            res.status(400).json({ success: false, message: 'Select an active customer account.' });
            return;
        }
        const asset = await AssetRecord.create({ ...details, customerName });
        res.status(201).json({ success: true, asset });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            res.status(409).json({ success: false, message: 'Asset tag or serial number already exists.' });
            return;
        }
        console.error('Create asset error:', error);
        res.status(500).json({ success: false, message: 'Failed to create asset.' });
    }
}
export async function updateAsset(req, res) {
    const id = routeId(req);
    const body = readBody(req.body);
    const details = body && parseAsset(body);
    if (!validId(id) || !details) {
        res.status(400).json({ success: false, message: 'Asset details are invalid.' });
        return;
    }
    try {
        const customerName = await customerNameFor(details.customerId);
        if (customerName === null) {
            res.status(400).json({ success: false, message: 'Select an active customer account.' });
            return;
        }
        const asset = await AssetRecord.findByIdAndUpdate(id, { ...details, customerName }, { new: true, runValidators: true });
        if (!asset) {
            res.status(404).json({ success: false, message: 'Asset not found.' });
            return;
        }
        res.json({ success: true, asset });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            res.status(409).json({ success: false, message: 'Asset tag or serial number already exists.' });
            return;
        }
        console.error('Update asset error:', error);
        res.status(500).json({ success: false, message: 'Failed to update asset.' });
    }
}
async function parseBundle(body) {
    const sku = readString(body, 'sku').toUpperCase();
    const name = readString(body, 'name');
    const category = readString(body, 'category');
    const description = readString(body, 'description');
    const salePrice = readNumber(body['salePrice']);
    const status = body['status'] ?? 'Active';
    const rawComponents = body['components'];
    if (!sku || sku.length > 40 || !name || name.length > 140 || !category || category.length > 80 || description.length > 1000 ||
        salePrice === null || !['Active', 'Inactive'].includes(String(status)) || !Array.isArray(rawComponents) || rawComponents.length < 1 || rawComponents.length > 50)
        return null;
    const componentIds = new Set();
    const inputs = [];
    for (const raw of rawComponents) {
        const component = readBody(raw);
        const id = component ? readString(component, 'inventoryItemId') : '';
        const quantity = component ? readNumber(component['quantity'], 0.01) : null;
        if (!component || !validId(id) || quantity === null || componentIds.has(id))
            return null;
        componentIds.add(id);
        inputs.push({ id, quantity });
    }
    const items = await InventoryItem.find({ _id: { $in: inputs.map(component => component.id) }, status: 'Active' }).lean();
    if (items.length !== inputs.length)
        return null;
    const byId = new Map(items.map(item => [String(item._id), item]));
    return {
        sku, name, category, description, salePrice, status: status,
        components: inputs.map(input => {
            const item = byId.get(input.id);
            return { inventoryItemId: input.id, sku: item.sku, itemName: item.name, unit: item.unit, quantity: input.quantity };
        })
    };
}
export async function getBundles(_req, res) {
    try {
        const bundles = await BundleProduct.find().sort({ updatedAt: -1 }).lean();
        res.json({ success: true, count: bundles.length, bundles });
    }
    catch (error) {
        console.error('Get bundle products error:', error);
        res.status(500).json({ success: false, message: 'Failed to load bundle products.' });
    }
}
export async function createBundle(req, res) {
    const body = readBody(req.body);
    const details = body && await parseBundle(body);
    if (!details) {
        res.status(400).json({ success: false, message: 'Bundle details need a unique SKU, price and active component items.' });
        return;
    }
    try {
        const bundle = await BundleProduct.create(details);
        res.status(201).json({ success: true, bundle });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            res.status(409).json({ success: false, message: 'Bundle SKU already exists.' });
            return;
        }
        console.error('Create bundle error:', error);
        res.status(500).json({ success: false, message: 'Failed to create bundle product.' });
    }
}
export async function updateBundle(req, res) {
    const id = routeId(req);
    const body = readBody(req.body);
    const details = body && await parseBundle(body);
    if (!validId(id) || !details) {
        res.status(400).json({ success: false, message: 'Bundle details are invalid.' });
        return;
    }
    try {
        const bundle = await BundleProduct.findByIdAndUpdate(id, details, { new: true, runValidators: true });
        if (!bundle) {
            res.status(404).json({ success: false, message: 'Bundle product not found.' });
            return;
        }
        res.json({ success: true, bundle });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            res.status(409).json({ success: false, message: 'Bundle SKU already exists.' });
            return;
        }
        console.error('Update bundle error:', error);
        res.status(500).json({ success: false, message: 'Failed to update bundle product.' });
    }
}
export async function getExpenseVouchers(_req, res) {
    try {
        const vouchers = await ExpenseVoucher.find().sort({ voucherDate: -1, createdAt: -1 }).lean();
        res.json({ success: true, count: vouchers.length, vouchers });
    }
    catch (error) {
        console.error('Get expense vouchers error:', error);
        res.status(500).json({ success: false, message: 'Failed to load expense vouchers.' });
    }
}
export async function createExpenseVoucher(req, res) {
    const body = readBody(req.body);
    if (!body) {
        res.status(400).json({ success: false, message: 'Expense voucher details are invalid.' });
        return;
    }
    const voucherDate = readDate(body['voucherDate']);
    const category = readString(body, 'category');
    const payee = readString(body, 'payee');
    const amount = readNumber(body['amount'], 0.01);
    const paymentMethod = readString(body, 'paymentMethod');
    const reference = readString(body, 'reference');
    const description = readString(body, 'description');
    if (!voucherDate || !category || category.length > 80 || !payee || payee.length > 160 || amount === null || !paymentMethod || paymentMethod.length > 40 || reference.length > 120 || !description || description.length > 1000) {
        res.status(400).json({ success: false, message: 'Enter a valid date, category, payee, amount, method and description.' });
        return;
    }
    try {
        const voucher = await ExpenseVoucher.create({
            voucherNumber: await nextNumber('expense-voucher', 'EV'), voucherDate, category, payee, amount,
            paymentMethod, reference, description, status: 'Draft', createdBy: getRequestSession(req)?.sub ?? 'Administrator',
            approvedBy: '', paidAt: null
        });
        res.status(201).json({ success: true, voucher });
    }
    catch (error) {
        console.error('Create expense voucher error:', error);
        res.status(500).json({ success: false, message: 'Failed to create expense voucher.' });
    }
}
export async function updateExpenseVoucher(req, res) {
    const id = routeId(req);
    const body = readBody(req.body);
    const status = body?.['status'];
    const allowed = ['Approved', 'Paid', 'Rejected'];
    if (!validId(id) || typeof status !== 'string' || !allowed.includes(status)) {
        res.status(400).json({ success: false, message: 'Expense voucher status is invalid.' });
        return;
    }
    try {
        const voucher = await ExpenseVoucher.findById(id);
        if (!voucher) {
            res.status(404).json({ success: false, message: 'Expense voucher not found.' });
            return;
        }
        const transitions = { Draft: ['Approved', 'Rejected'], Approved: ['Paid', 'Rejected'], Paid: [], Rejected: [] };
        if (!transitions[voucher.status].includes(status)) {
            res.status(409).json({ success: false, message: `A voucher cannot move from ${voucher.status} to ${status}.` });
            return;
        }
        voucher.status = status;
        if (status === 'Approved')
            voucher.approvedBy = getRequestSession(req)?.sub ?? 'Administrator';
        if (status === 'Paid')
            voucher.paidAt = new Date();
        await voucher.save();
        res.json({ success: true, voucher });
    }
    catch (error) {
        console.error('Update expense voucher error:', error);
        res.status(500).json({ success: false, message: 'Failed to update expense voucher.' });
    }
}
export async function getSalesInvoices(_req, res) {
    try {
        const invoices = await SalesInvoice.find().sort({ issueDate: -1, createdAt: -1 }).lean();
        res.json({ success: true, count: invoices.length, invoices });
    }
    catch (error) {
        console.error('Get sales invoices error:', error);
        res.status(500).json({ success: false, message: 'Failed to load sales invoices.' });
    }
}
export async function createSalesInvoice(req, res) {
    const body = readBody(req.body);
    const orderId = body ? readString(body, 'orderId') : '';
    const dueDate = body ? readDate(body['dueDate']) : undefined;
    const description = body ? readString(body, 'description') : '';
    const notes = body ? readString(body, 'notes') : '';
    if (!body || !validId(orderId) || dueDate === undefined || description.length > 2000 || notes.length > 1000) {
        res.status(400).json({ success: false, message: 'Select a sales order and enter a valid due date.' });
        return;
    }
    try {
        const order = await SalesOrder.findById(orderId).lean();
        if (!order || order.status === 'Cancelled') {
            res.status(400).json({ success: false, message: 'Only active sales orders can be invoiced.' });
            return;
        }
        const invoice = await SalesInvoice.create({
            invoiceNumber: await nextNumber('sales-invoice', 'INV'),
            orderId: String(order._id), orderNumber: order.orderNumber, customerId: order.customerId, customerName: order.customerName,
            issueDate: new Date(), dueDate, subTotal: order.subTotal, discountAmount: order.discountAmount ?? 0,
            taxAmount: order.taxAmount, roundOff: order.roundOff ?? 0, total: order.total,
            status: 'Draft', description, notes, createdBy: getRequestSession(req)?.sub ?? 'Administrator', paidAt: null
        });
        res.status(201).json({ success: true, invoice });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            res.status(409).json({ success: false, message: 'This sales order already has an invoice.' });
            return;
        }
        console.error('Create sales invoice error:', error);
        res.status(500).json({ success: false, message: 'Failed to create sales invoice.' });
    }
}
export async function recordSalesInvoicePayment(req, res) {
    const id = routeId(req);
    const body = readBody(req.body);
    const rawAmount = body ? readNumber(body['amount'], 0.01) : null;
    const amount = rawAmount === null ? null : Math.round(rawAmount * 100) / 100;
    const paymentDate = body ? readDate(body['paymentDate']) : undefined;
    const method = body ? readString(body, 'method') : '';
    const reference = body ? readString(body, 'reference') : '';
    const notes = body ? readString(body, 'notes') : '';
    const methods = ['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Card', 'Other'];
    if (!validId(id) || !body || amount === null || amount < 0.01 || !paymentDate || paymentDate === undefined ||
        !methods.includes(method) || reference.length > 120 || notes.length > 500) {
        res.status(400).json({ success: false, message: 'Enter a valid payment amount, date, and method.' });
        return;
    }
    try {
        const invoice = await SalesInvoice.findById(id);
        if (!invoice) {
            res.status(404).json({ success: false, message: 'Sales invoice not found.' });
            return;
        }
        if (invoice.status !== 'Issued' && invoice.status !== 'Partially Paid') {
            res.status(409).json({ success: false, message: 'Only issued invoices with an outstanding balance can receive payments.' });
            return;
        }
        const paidBefore = Math.round((invoice.amountPaid ?? 0) * 100) / 100;
        const remaining = Math.round((invoice.total - paidBefore) * 100) / 100;
        if (amount > remaining) {
            res.status(409).json({ success: false, message: `Payment exceeds the remaining balance of ${remaining.toFixed(2)}.` });
            return;
        }
        const paidAfter = Math.round((paidBefore + amount) * 100) / 100;
        const fullyPaid = paidAfter >= invoice.total;
        const updated = await SalesInvoice.findOneAndUpdate({
            _id: id,
            status: invoice.status,
            $or: [{ amountPaid: paidBefore }, { amountPaid: { $exists: false } }]
        }, {
            $inc: { amountPaid: amount },
            $push: {
                payments: {
                    amount,
                    paymentDate,
                    method,
                    reference,
                    notes,
                    receivedBy: getRequestSession(req)?.sub ?? 'Administrator'
                }
            },
            $set: {
                status: fullyPaid ? 'Paid' : 'Partially Paid',
                ...(fullyPaid ? { paidAt: paymentDate } : {})
            }
        }, { new: true, runValidators: true });
        if (!updated) {
            res.status(409).json({ success: false, message: 'The invoice changed while recording payment. Refresh and try again.' });
            return;
        }
        res.json({ success: true, invoice: updated });
    }
    catch (error) {
        console.error('Record sales invoice payment error:', error);
        res.status(500).json({ success: false, message: 'Failed to record invoice payment.' });
    }
}
export async function updateSalesInvoice(req, res) {
    const id = routeId(req);
    const body = readBody(req.body);
    const status = body?.['status'];
    const allowed = ['Issued', 'Voided'];
    if (!validId(id) || typeof status !== 'string' || !allowed.includes(status)) {
        res.status(400).json({ success: false, message: 'Invoice status is invalid.' });
        return;
    }
    try {
        const invoice = await SalesInvoice.findById(id);
        if (!invoice) {
            res.status(404).json({ success: false, message: 'Sales invoice not found.' });
            return;
        }
        const transitions = {
            Draft: ['Issued', 'Voided'], Issued: ['Voided'], 'Partially Paid': [], Paid: [], Voided: []
        };
        if (!transitions[invoice.status].includes(status)) {
            res.status(409).json({ success: false, message: `An invoice cannot move from ${invoice.status} to ${status}.` });
            return;
        }
        invoice.status = status;
        if (status === 'Issued')
            invoice.issueDate = new Date();
        await invoice.save();
        res.json({ success: true, invoice });
    }
    catch (error) {
        console.error('Update sales invoice error:', error);
        res.status(500).json({ success: false, message: 'Failed to update sales invoice.' });
    }
}
