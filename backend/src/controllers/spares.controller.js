import mongoose from 'mongoose';
import { CodeCounter } from '../models/CodeCounter.js';
import { DefectiveReturn } from '../models/DefectiveReturn.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { SpareIssue } from '../models/SpareIssue.js';
import { SpareRequest } from '../models/SpareRequest.js';
import { Ticket } from '../models/Ticket.js';
import { getRequestSession } from '../middleware/auth.js';
function readBody(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function readString(body, key) {
    return typeof body[key] === 'string' ? body[key].trim() : '';
}
function readQuantity(body) {
    const quantity = Number(body['quantity']);
    return Number.isFinite(quantity) && quantity > 0 && quantity <= 1_000_000 ? quantity : null;
}
async function nextNumber(counterId, prefix) {
    const counter = await CodeCounter.findByIdAndUpdate(counterId, { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return `${prefix}-${String(counter?.sequence ?? 1).padStart(5, '0')}`;
}
function invalidId(value) {
    return !mongoose.isValidObjectId(value);
}
export async function getSpareRequests(_req, res) {
    try {
        const requests = await SpareRequest.find().sort({ createdAt: -1 }).lean();
        res.json({ success: true, count: requests.length, requests });
    }
    catch (error) {
        console.error('Get spare requests error:', error);
        res.status(500).json({ success: false, message: 'Failed to load spare requests.' });
    }
}
export async function createSpareRequest(req, res) {
    const body = readBody(req.body);
    if (!body) {
        res.status(400).json({ success: false, message: 'Spare request details are invalid.' });
        return;
    }
    const ticketId = readString(body, 'ticketId');
    const inventoryItemId = readString(body, 'inventoryItemId');
    const quantityRequested = readQuantity(body);
    const reason = readString(body, 'reason');
    if (invalidId(ticketId) || invalidId(inventoryItemId) || quantityRequested === null || !reason || reason.length > 1000) {
        res.status(400).json({ success: false, message: 'Choose a ticket and spare, enter a valid quantity, and explain the request.' });
        return;
    }
    try {
        const [ticket, item] = await Promise.all([
            Ticket.findById(ticketId).lean(),
            InventoryItem.findOne({ _id: inventoryItemId, status: 'Active' }).lean()
        ]);
        if (!ticket) {
            res.status(404).json({ success: false, message: 'Service ticket not found.' });
            return;
        }
        if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
            res.status(409).json({ success: false, message: 'Spare requests require an open service ticket.' });
            return;
        }
        if (!item) {
            res.status(404).json({ success: false, message: 'Active spare item not found.' });
            return;
        }
        const request = await SpareRequest.create({
            requestNumber: await nextNumber('spare-request', 'SPR'),
            ticketId: String(ticket._id),
            ticketNumber: ticket.ticketNumber,
            customerId: ticket.customerId,
            customerName: ticket.customerName,
            branchId: ticket.branchId,
            branchName: ticket.branchName,
            inventoryItemId: String(item._id),
            sku: item.sku,
            itemName: item.name,
            unit: item.unit,
            unitCost: item.unitCost,
            quantityRequested,
            quantityIssued: 0,
            reason,
            requestedBy: getRequestSession(req)?.sub ?? 'Administrator',
            status: 'Requested'
        });
        res.status(201).json({ success: true, request });
    }
    catch (error) {
        console.error('Create spare request error:', error);
        res.status(500).json({ success: false, message: 'Failed to create spare request.' });
    }
}
export async function rejectSpareRequest(req, res) {
    const rawId = req.params['id'];
    const id = typeof rawId === 'string' ? rawId : '';
    if (invalidId(id)) {
        res.status(400).json({ success: false, message: 'Spare request ID is invalid.' });
        return;
    }
    try {
        const request = await SpareRequest.findOneAndUpdate({ _id: id, status: 'Requested', quantityIssued: 0 }, { $set: { status: 'Rejected' } }, { new: true });
        if (!request) {
            res.status(409).json({ success: false, message: 'Only unissued requests can be rejected.' });
            return;
        }
        res.json({ success: true, request });
    }
    catch (error) {
        console.error('Reject spare request error:', error);
        res.status(500).json({ success: false, message: 'Failed to reject spare request.' });
    }
}
export async function getSpareIssues(_req, res) {
    try {
        const issues = await SpareIssue.find().sort({ issuedAt: -1 }).lean();
        res.json({ success: true, count: issues.length, issues });
    }
    catch (error) {
        console.error('Get spare issues error:', error);
        res.status(500).json({ success: false, message: 'Failed to load spare issues.' });
    }
}
export async function issueSpare(req, res) {
    const rawId = req.params['id'];
    const id = typeof rawId === 'string' ? rawId : '';
    const body = readBody(req.body);
    const quantity = body && readQuantity(body);
    const notes = body ? readString(body, 'notes') : '';
    if (invalidId(id) || !body || quantity === null || notes.length > 500) {
        res.status(400).json({ success: false, message: 'Issue quantity or notes are invalid.' });
        return;
    }
    let request = null;
    let debited = false;
    let issueId = '';
    try {
        request = await SpareRequest.findById(id);
        if (!request || !['Requested', 'Partially Issued'].includes(request.status)) {
            res.status(409).json({ success: false, message: 'This spare request is no longer available to issue.' });
            return;
        }
        const remaining = request.quantityRequested - request.quantityIssued;
        if (quantity > remaining) {
            res.status(400).json({ success: false, message: `Only ${remaining} ${request.unit} remain on this request.` });
            return;
        }
        const previousStatus = request.status;
        const locked = await SpareRequest.findOneAndUpdate({ _id: id, status: previousStatus }, { $set: { status: 'Issuing' } }, { new: false });
        if (!locked) {
            res.status(409).json({ success: false, message: 'Another user is processing this spare request.' });
            return;
        }
        const stock = await InventoryItem.findOneAndUpdate({ _id: request.inventoryItemId, status: 'Active', quantityOnHand: { $gte: quantity } }, { $inc: { quantityOnHand: -quantity } }, { new: true });
        if (!stock) {
            await SpareRequest.updateOne({ _id: id, status: 'Issuing' }, { $set: { status: previousStatus } });
            res.status(409).json({ success: false, message: 'There is not enough available stock to issue that quantity.' });
            return;
        }
        debited = true;
        const issue = await SpareIssue.create({
            issueNumber: await nextNumber('spare-issue', 'SPI'),
            requestId: String(request._id),
            requestNumber: request.requestNumber,
            ticketId: request.ticketId,
            ticketNumber: request.ticketNumber,
            inventoryItemId: request.inventoryItemId,
            sku: request.sku,
            itemName: request.itemName,
            unit: request.unit,
            unitCost: request.unitCost,
            quantity,
            customerName: request.customerName,
            branchName: request.branchName,
            issuedBy: getRequestSession(req)?.sub ?? 'Administrator',
            notes,
            issuedAt: new Date()
        });
        issueId = String(issue._id);
        const quantityIssued = request.quantityIssued + quantity;
        const updatedRequest = await SpareRequest.findOneAndUpdate({ _id: id, status: 'Issuing' }, { $set: {
                quantityIssued,
                status: quantityIssued >= request.quantityRequested ? 'Issued' : 'Partially Issued'
            } }, { new: true });
        if (!updatedRequest)
            throw new Error('Spare request could not be finalized after issue.');
        res.status(201).json({ success: true, issue, request: updatedRequest, stock });
    }
    catch (error) {
        if (issueId)
            await SpareIssue.deleteOne({ _id: issueId }).catch(() => undefined);
        if (debited && request) {
            await InventoryItem.updateOne({ _id: request.inventoryItemId }, { $inc: { quantityOnHand: quantity } }).catch(() => undefined);
        }
        if (request) {
            await SpareRequest.updateOne({ _id: id, status: 'Issuing' }, { $set: { status: request.status } }).catch(() => undefined);
        }
        console.error('Issue spare error:', error);
        res.status(500).json({ success: false, message: 'Failed to issue spare. Stock has been restored if the issue was not saved.' });
    }
}
export async function getDefectiveReturns(_req, res) {
    try {
        const returns = await DefectiveReturn.find().sort({ createdAt: -1 }).lean();
        res.json({ success: true, count: returns.length, returns });
    }
    catch (error) {
        console.error('Get defective returns error:', error);
        res.status(500).json({ success: false, message: 'Failed to load defective returns.' });
    }
}
export async function createDefectiveReturn(req, res) {
    const body = readBody(req.body);
    if (!body) {
        res.status(400).json({ success: false, message: 'Defective return details are invalid.' });
        return;
    }
    const issueId = readString(body, 'issueId');
    const quantity = readQuantity(body);
    const reason = readString(body, 'reason');
    if (invalidId(issueId) || quantity === null || !reason || reason.length > 1000) {
        res.status(400).json({ success: false, message: 'Choose an issued spare, enter a valid quantity, and describe the defect.' });
        return;
    }
    let reservedIssueId = '';
    try {
        const issue = await SpareIssue.findOneAndUpdate({
            _id: issueId,
            $expr: { $lte: [{ $add: ['$returnedQuantity', quantity] }, '$quantity'] }
        }, { $inc: { returnedQuantity: quantity } }, { new: true });
        if (!issue) {
            res.status(409).json({ success: false, message: 'Return quantity exceeds the unused issued quantity.' });
            return;
        }
        reservedIssueId = String(issue._id);
        const defectiveReturn = await DefectiveReturn.create({
            returnNumber: await nextNumber('defective-return', 'DR'),
            issueId: String(issue._id),
            issueNumber: issue.issueNumber,
            ticketId: issue.ticketId,
            ticketNumber: issue.ticketNumber,
            inventoryItemId: issue.inventoryItemId,
            sku: issue.sku,
            itemName: issue.itemName,
            customerName: issue.customerName,
            branchName: issue.branchName,
            quantity,
            reason,
            status: 'Submitted',
            submittedBy: getRequestSession(req)?.sub ?? 'Administrator',
            receivedBy: '',
            receivedAt: null
        });
        res.status(201).json({ success: true, return: defectiveReturn });
    }
    catch (error) {
        if (reservedIssueId) {
            await SpareIssue.updateOne({ _id: reservedIssueId }, { $inc: { returnedQuantity: -quantity } }).catch(() => undefined);
        }
        console.error('Create defective return error:', error);
        res.status(500).json({ success: false, message: 'Failed to create defective return.' });
    }
}
export async function updateDefectiveReturn(req, res) {
    const rawId = req.params['id'];
    const id = typeof rawId === 'string' ? rawId : '';
    const body = readBody(req.body);
    const status = body?.['status'];
    if (invalidId(id) || (status !== 'Received' && status !== 'Rejected')) {
        res.status(400).json({ success: false, message: 'Choose a valid return status.' });
        return;
    }
    try {
        const defectiveReturn = await DefectiveReturn.findOneAndUpdate({ _id: id, status: 'Submitted' }, { $set: {
                status,
                receivedBy: status === 'Received' ? (getRequestSession(req)?.sub ?? 'Administrator') : '',
                receivedAt: status === 'Received' ? new Date() : null
            } }, { new: true });
        if (!defectiveReturn) {
            res.status(409).json({ success: false, message: 'Only submitted returns can be updated.' });
            return;
        }
        if (status === 'Rejected') {
            await SpareIssue.updateOne({ _id: defectiveReturn.issueId, returnedQuantity: { $gte: defectiveReturn.quantity } }, { $inc: { returnedQuantity: -defectiveReturn.quantity } });
        }
        res.json({ success: true, return: defectiveReturn });
    }
    catch (error) {
        console.error('Update defective return error:', error);
        res.status(500).json({ success: false, message: 'Failed to update defective return.' });
    }
}
