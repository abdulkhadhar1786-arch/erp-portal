import mongoose from 'mongoose';
import { CodeCounter } from '../models/CodeCounter.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { StockDocument } from '../models/StockDocument.js';
import { Vendor } from '../models/Vendor.js';
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
function validId(value) { return mongoose.isValidObjectId(value); }
function routeId(req) {
    const value = req.params['id'];
    return typeof value === 'string' ? value : '';
}
function readDate(value) {
    if (value === undefined || value === null || value === '')
        return null;
    if (typeof value !== 'string')
        return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}
async function nextNumber(counterId, prefix) {
    const counter = await CodeCounter.findByIdAndUpdate(counterId, { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return `${prefix}-${String(counter?.sequence ?? 1).padStart(5, '0')}`;
}
export async function getVendors(_req, res) {
    try {
        const vendors = await Vendor.find().sort({ name: 1 }).lean();
        res.json({ success: true, count: vendors.length, vendors });
    }
    catch (error) {
        console.error('Get vendors error:', error);
        res.status(500).json({ success: false, message: 'Failed to load vendors.' });
    }
}
function parseVendor(body) {
    const vendorCode = readString(body, 'vendorCode').toUpperCase();
    const name = readString(body, 'name');
    const contactName = readString(body, 'contactName');
    const email = readString(body, 'email').toLowerCase();
    const phone = readString(body, 'phone');
    const taxNumber = readString(body, 'taxNumber').toUpperCase();
    const address = readString(body, 'address');
    const status = body['status'] ?? 'Active';
    if (!vendorCode || vendorCode.length > 40 || !name || name.length > 160 || contactName.length > 120 || email.length > 254 ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || phone.length > 40 || taxNumber.length > 40 || address.length > 500 ||
        !['Active', 'Inactive'].includes(String(status)))
        return null;
    return { vendorCode, name, contactName, email, phone, taxNumber, address, status: status };
}
export async function createVendor(req, res) {
    const body = readBody(req.body);
    const details = body && parseVendor(body);
    if (!details) {
        res.status(400).json({ success: false, message: 'Vendor details are invalid.' });
        return;
    }
    try {
        const vendor = await Vendor.create(details);
        res.status(201).json({ success: true, vendor });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            res.status(409).json({ success: false, message: 'Vendor code already exists.' });
            return;
        }
        console.error('Create vendor error:', error);
        res.status(500).json({ success: false, message: 'Failed to create vendor.' });
    }
}
export async function updateVendor(req, res) {
    const id = routeId(req);
    const body = readBody(req.body);
    const details = body && parseVendor(body);
    if (!validId(id) || !details) {
        res.status(400).json({ success: false, message: 'Vendor details are invalid.' });
        return;
    }
    try {
        const vendor = await Vendor.findByIdAndUpdate(id, details, { new: true, runValidators: true });
        if (!vendor) {
            res.status(404).json({ success: false, message: 'Vendor not found.' });
            return;
        }
        res.json({ success: true, vendor });
    }
    catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
            res.status(409).json({ success: false, message: 'Vendor code already exists.' });
            return;
        }
        console.error('Update vendor error:', error);
        res.status(500).json({ success: false, message: 'Failed to update vendor.' });
    }
}
export async function getPurchaseOrders(_req, res) {
    try {
        const orders = await PurchaseOrder.find().sort({ orderDate: -1, createdAt: -1 }).lean();
        res.json({ success: true, count: orders.length, orders });
    }
    catch (error) {
        console.error('Get purchase orders error:', error);
        res.status(500).json({ success: false, message: 'Failed to load purchase orders.' });
    }
}
export async function createPurchaseOrder(req, res) {
    const body = readBody(req.body);
    const vendorId = body ? readString(body, 'vendorId') : '';
    const rawLines = body?.['lines'];
    const expectedDate = body ? readDate(body['expectedDate']) : undefined;
    const notes = body ? readString(body, 'notes') : '';
    if (!body || !validId(vendorId) || !Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > 100 || expectedDate === undefined || notes.length > 1000) {
        res.status(400).json({ success: false, message: 'Select a vendor and enter valid purchase order lines.' });
        return;
    }
    const seen = new Set();
    const inputs = [];
    for (const raw of rawLines) {
        const line = readBody(raw);
        const inventoryItemId = line ? readString(line, 'inventoryItemId') : '';
        const quantityOrdered = line ? readNumber(line['quantityOrdered'], 0.01) : null;
        const unitCost = line ? readNumber(line['unitCost']) : null;
        if (!line || !validId(inventoryItemId) || quantityOrdered === null || unitCost === null || seen.has(inventoryItemId)) {
            res.status(400).json({ success: false, message: 'Check each inventory item, positive quantity and non-negative unit cost. Use one line per SKU.' });
            return;
        }
        seen.add(inventoryItemId);
        inputs.push({ inventoryItemId, quantityOrdered, unitCost });
    }
    try {
        const [vendor, items] = await Promise.all([
            Vendor.findOne({ _id: vendorId, status: 'Active' }).lean(),
            InventoryItem.find({ _id: { $in: inputs.map(line => line.inventoryItemId) }, status: 'Active' }).lean()
        ]);
        if (!vendor || items.length !== inputs.length) {
            res.status(400).json({ success: false, message: 'Select an active vendor and active inventory items.' });
            return;
        }
        const itemMap = new Map(items.map(item => [String(item._id), item]));
        const lines = inputs.map(line => {
            const item = itemMap.get(line.inventoryItemId);
            return {
                inventoryItemId: line.inventoryItemId, sku: item.sku, itemName: item.name, unit: item.unit,
                quantityOrdered: line.quantityOrdered, quantityReceived: 0, unitCost: line.unitCost
            };
        });
        const order = await PurchaseOrder.create({
            purchaseOrderNumber: await nextNumber('purchase-order', 'PO'),
            vendorId: String(vendor._id), vendorName: vendor.name, orderDate: new Date(), expectedDate,
            status: 'Draft', lines, notes, createdBy: getRequestSession(req)?.sub ?? 'Administrator'
        });
        res.status(201).json({ success: true, order });
    }
    catch (error) {
        console.error('Create purchase order error:', error);
        res.status(500).json({ success: false, message: 'Failed to create purchase order.' });
    }
}
export async function updatePurchaseOrderStatus(req, res) {
    const id = routeId(req);
    const body = readBody(req.body);
    const status = body?.['status'];
    const allowed = ['Placed', 'Cancelled'];
    if (!validId(id) || typeof status !== 'string' || !allowed.includes(status)) {
        res.status(400).json({ success: false, message: 'Purchase order status is invalid.' });
        return;
    }
    try {
        const order = await PurchaseOrder.findById(id);
        if (!order) {
            res.status(404).json({ success: false, message: 'Purchase order not found.' });
            return;
        }
        const valid = status === 'Placed' ? order.status === 'Draft' : order.status === 'Draft' || order.status === 'Placed';
        if (!valid) {
            res.status(409).json({ success: false, message: `A purchase order cannot move from ${order.status} to ${status}.` });
            return;
        }
        order.status = status;
        await order.save();
        res.json({ success: true, order });
    }
    catch (error) {
        console.error('Update purchase order status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update purchase order.' });
    }
}
export async function receivePurchaseOrder(req, res) {
    const id = routeId(req);
    const body = readBody(req.body);
    const rawLines = body?.['lines'];
    if (!validId(id) || !Array.isArray(rawLines) || rawLines.length < 1 || rawLines.length > 100) {
        res.status(400).json({ success: false, message: 'Select one or more purchase order lines to receive.' });
        return;
    }
    const inputLines = [];
    const seen = new Set();
    for (const raw of rawLines) {
        const line = readBody(raw);
        const lineIndex = Number(line?.['lineIndex']);
        const quantity = line ? readNumber(line['quantity'], 0.01) : null;
        if (!line || !Number.isInteger(lineIndex) || lineIndex < 0 || quantity === null || seen.has(lineIndex)) {
            res.status(400).json({ success: false, message: 'Each receipt needs a valid line and positive received quantity.' });
            return;
        }
        seen.add(lineIndex);
        inputLines.push({ lineIndex, quantity });
    }
    let order = await PurchaseOrder.findById(id);
    if (!order || !['Placed', 'Partially Received'].includes(order.status)) {
        res.status(409).json({ success: false, message: 'Only placed purchase orders can receive stock.' });
        return;
    }
    const previousStatus = order.status;
    for (const input of inputLines) {
        const line = order.lines[input.lineIndex];
        if (!line || input.quantity > line.quantityOrdered - line.quantityReceived) {
            res.status(400).json({ success: false, message: 'A received quantity exceeds the outstanding purchase order quantity.' });
            return;
        }
    }
    const locked = await PurchaseOrder.findOneAndUpdate({ _id: id, status: previousStatus }, { $set: { status: 'Receiving' } }, { new: false });
    if (!locked) {
        res.status(409).json({ success: false, message: 'Another user is processing this purchase order.' });
        return;
    }
    const changes = [];
    let stockDocumentId = '';
    try {
        const stockLines = inputLines.map(input => {
            const line = order.lines[input.lineIndex];
            return { inventoryItemId: line.inventoryItemId, sku: line.sku, itemName: line.itemName, unit: line.unit, quantity: input.quantity, direction: 'In', unitCost: line.unitCost };
        });
        for (const line of stockLines) {
            const updated = await InventoryItem.findOneAndUpdate({ _id: line.inventoryItemId, status: 'Active' }, { $inc: { quantityOnHand: line.quantity } }, { new: true });
            if (!updated)
                throw new Error(`Inventory item ${line.sku} is inactive or missing.`);
            changes.push({ id: line.inventoryItemId, quantity: line.quantity });
        }
        const stockDocument = await StockDocument.create({
            documentNumber: await nextNumber('stock-grn', 'GRN'), type: 'Goods Receipt', partyName: order.vendorName,
            purchaseOrderId: String(order._id), purchaseOrderNumber: order.purchaseOrderNumber,
            reference: order.purchaseOrderNumber, notes: `Received against ${order.purchaseOrderNumber}.`,
            lines: stockLines, createdBy: getRequestSession(req)?.sub ?? 'Administrator', postedAt: new Date()
        });
        stockDocumentId = String(stockDocument._id);
        for (const input of inputLines)
            order.lines[input.lineIndex].quantityReceived += input.quantity;
        const fullyReceived = order.lines.every(line => line.quantityReceived >= line.quantityOrdered);
        order.status = fullyReceived ? 'Received' : 'Partially Received';
        order.markModified('lines');
        await order.save();
        res.status(201).json({ success: true, order, stockDocument });
    }
    catch (error) {
        if (stockDocumentId)
            await StockDocument.deleteOne({ _id: stockDocumentId }).catch(() => undefined);
        for (const change of changes) {
            await InventoryItem.updateOne({ _id: change.id }, { $inc: { quantityOnHand: -change.quantity } }).catch(() => undefined);
        }
        await PurchaseOrder.updateOne({ _id: id, status: 'Receiving' }, { $set: { status: previousStatus } }).catch(() => undefined);
        console.error('Receive purchase order error:', error);
        const message = error instanceof Error ? error.message : 'Failed to receive purchase order.';
        res.status(500).json({ success: false, message: `${message} Inventory changes were reversed where possible.` });
    }
}
