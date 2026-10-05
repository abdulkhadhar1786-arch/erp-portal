import mongoose from 'mongoose';
import { InventoryItem } from '../models/InventoryItem.js';
function readBody(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function readString(body, key) {
    return typeof body[key] === 'string' ? body[key].trim() : undefined;
}
function readNumber(body, key) {
    const value = body[key];
    if (typeof value !== 'number' && typeof value !== 'string')
        return undefined;
    if (typeof value === 'string' && value.trim() === '')
        return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : undefined;
}
function readItem(body) {
    const sku = (readString(body, 'sku') ?? '').toUpperCase();
    const name = readString(body, 'name') ?? '';
    const category = readString(body, 'category') ?? '';
    const unit = readString(body, 'unit') ?? 'unit';
    const quantityOnHand = readNumber(body, 'quantityOnHand');
    const reorderLevel = readNumber(body, 'reorderLevel');
    const unitCost = readNumber(body, 'unitCost');
    const status = body['status'] ?? 'Active';
    if (!/^[A-Z0-9][A-Z0-9._/-]{1,39}$/.test(sku) || !name || name.length > 140 ||
        !category || category.length > 80 || !unit || unit.length > 24 ||
        quantityOnHand === undefined || reorderLevel === undefined || unitCost === undefined ||
        (status !== 'Active' && status !== 'Inactive'))
        return null;
    return {
        sku,
        name,
        category,
        description: readString(body, 'description') ?? '',
        unit,
        quantityOnHand,
        reorderLevel,
        unitCost,
        supplier: readString(body, 'supplier') ?? '',
        location: readString(body, 'location') ?? '',
        status: status
    };
}
function handleError(res, error, message) {
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ success: false, message: 'Inventory item details are invalid.' });
        return;
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        res.status(409).json({ success: false, message: 'That SKU is already in use.' });
        return;
    }
    console.error(message, error);
    res.status(500).json({ success: false, message });
}
export async function getInventoryItems(_req, res) {
    try {
        const items = await InventoryItem.find().sort({ category: 1, name: 1 }).lean();
        res.json({
            success: true,
            count: items.length,
            items: items.map(item => ({ ...item, _id: String(item._id) }))
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to load inventory.');
    }
}
export async function createInventoryItem(req, res) {
    const body = readBody(req.body);
    const details = body && readItem(body);
    if (!details) {
        res.status(400).json({ success: false, message: 'Enter a valid SKU, item name, category, and non-negative stock values.' });
        return;
    }
    try {
        const item = await InventoryItem.create(details);
        res.status(201).json({ success: true, item: { ...item.toObject(), _id: String(item._id) } });
    }
    catch (error) {
        handleError(res, error, 'Failed to create inventory item.');
    }
}
export async function bulkImportInventoryItems(req, res) {
    const body = readBody(req.body);
    const rawItems = body?.['items'];
    if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 500) {
        res.status(400).json({ success: false, message: 'Upload between 1 and 500 inventory rows.' });
        return;
    }
    const details = rawItems.map(raw => {
        const itemBody = readBody(raw);
        return itemBody ? readItem(itemBody) : null;
    });
    if (details.some(item => item === null)) {
        res.status(400).json({ success: false, message: 'One or more rows contain an invalid SKU, name, category, or stock value.' });
        return;
    }
    const items = details;
    const skus = items.map(item => String(item['sku']));
    if (new Set(skus).size !== skus.length) {
        res.status(400).json({ success: false, message: 'The upload contains duplicate SKUs. Keep one row per SKU.' });
        return;
    }
    try {
        const existingSkus = new Set(await InventoryItem.find({ sku: { $in: skus } }).distinct('sku'));
        const result = await InventoryItem.bulkWrite(items.map(item => {
            const { quantityOnHand, ...metadata } = item;
            return {
                updateOne: {
                    filter: { sku: String(item['sku']) },
                    update: {
                        $set: metadata,
                        $setOnInsert: { quantityOnHand: Number(quantityOnHand) }
                    },
                    upsert: true
                }
            };
        }), { ordered: false });
        res.json({
            success: true,
            importedCount: items.length,
            createdCount: result.upsertedCount,
            updatedCount: items.length - result.upsertedCount,
            preservedStockCount: existingSkus.size
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to import inventory rows.');
    }
}
export async function updateInventoryItem(req, res) {
    const id = req.params['id'];
    const body = readBody(req.body);
    const details = body && readItem(body);
    if (!id || !mongoose.isValidObjectId(id) || !details) {
        res.status(400).json({ success: false, message: 'Inventory item details are invalid.' });
        return;
    }
    try {
        const item = await InventoryItem.findByIdAndUpdate(id, details, { new: true, runValidators: true }).lean();
        if (!item) {
            res.status(404).json({ success: false, message: 'Inventory item not found.' });
            return;
        }
        res.json({ success: true, item: { ...item, _id: String(item._id) } });
    }
    catch (error) {
        handleError(res, error, 'Failed to update inventory item.');
    }
}
