import { Ticket } from '../models/Ticket.js';
import mongoose from 'mongoose';
import { Branch } from '../models/Branch.js';
import { Customer } from '../models/Customer.js';
import { Employee } from '../models/Employee.js';
import { OfficeBranch } from '../models/OfficeBranch.js';
import { CodeCounter } from '../models/CodeCounter.js';
import { getRequestSession } from '../middleware/auth.js';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function isActiveEngineer(employeeId) {
    const employee = await Employee.findOne({
        _id: employeeId,
        status: 'Active',
        email: { $ne: '' },
        passwordHash: { $ne: '' }
    }).select('officeBranchId').lean();
    return !!employee && !!await OfficeBranch.exists({ _id: employee.officeBranchId, status: 'Active' });
}
export async function generateTicketNumber() {
    const [latestTicket] = await Ticket.aggregate([
        { $match: { ticketNumber: /^TKT-\d+$/ } },
        {
            $project: {
                number: {
                    $convert: {
                        input: { $arrayElemAt: [{ $split: ['$ticketNumber', '-'] }, 1] },
                        to: 'int',
                        onError: 0,
                        onNull: 0
                    }
                }
            }
        },
        { $sort: { number: -1 } },
        { $limit: 1 }
    ]);
    const latestNumber = Math.max(1000, latestTicket?.number ?? 1000);
    try {
        await CodeCounter.updateOne({ _id: 'ticket' }, { $max: { sequence: latestNumber } }, { upsert: true });
    }
    catch (error) {
        if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 11000) {
            throw error;
        }
        await CodeCounter.updateOne({ _id: 'ticket' }, { $max: { sequence: latestNumber } });
    }
    const counter = await CodeCounter.findByIdAndUpdate('ticket', { $inc: { sequence: 1 } }, { new: true });
    if (!counter)
        throw new Error('Could not allocate a ticket number.');
    return `TKT-${counter.get('sequence')}`;
}
/* ============================================================
   CREATE TICKET
   ============================================================ */
export async function createTicket(req, res) {
    try {
        const requestBody = req.body;
        if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
            res.status(400).json({ success: false, message: 'Ticket details are invalid.' });
            return;
        }
        const body = requestBody;
        const customerId = typeof body['customerId'] === 'string' ? body['customerId'].trim() : '';
        const branchId = typeof body['branchId'] === 'string' ? body['branchId'].trim() : '';
        const subject = typeof body['subject'] === 'string' ? body['subject'].trim() : '';
        const category = typeof body['category'] === 'string' ? body['category'].trim() : '';
        const description = typeof body['description'] === 'string' ? body['description'].trim() : '';
        const priority = body['priority'] === undefined ? 'Medium' : body['priority'];
        const reportedBy = typeof body['reportedBy'] === 'string' ? body['reportedBy'].trim() : '';
        const contactEmail = typeof body['contactEmail'] === 'string' ? body['contactEmail'].trim() : '';
        const contactPhone = typeof body['contactPhone'] === 'string' ? body['contactPhone'].trim() : '';
        const assetReference = typeof body['assetReference'] === 'string' ? body['assetReference'].trim() : '';
        const priorities = ['Low', 'Medium', 'High', 'Critical'];
        if (!customerId || !branchId || !subject || !category || !description) {
            res.status(400).json({
                success: false,
                message: 'Customer, branch, subject, category and description are required.'
            });
            return;
        }
        if (!mongoose.isValidObjectId(customerId) || !mongoose.isValidObjectId(branchId)) {
            res.status(400).json({ success: false, message: 'Select a valid customer and branch.' });
            return;
        }
        if (subject.length > 160 || category.length > 100 || description.length > 5000 ||
            reportedBy.length > 120 || contactEmail.length > 254 ||
            (contactEmail !== '' && !emailPattern.test(contactEmail)) ||
            contactPhone.length > 40 || assetReference.length > 160 ||
            typeof priority !== 'string' || !priorities.includes(priority)) {
            res.status(400).json({ success: false, message: 'Check the ticket details and requester contact information.' });
            return;
        }
        const [customer, branch] = await Promise.all([
            Customer.findOne({ _id: customerId, status: 'Active' }).select('name').lean(),
            Branch.findOne({
                _id: branchId,
                customerId,
                status: 'Active'
            }).select('name').lean()
        ]);
        if (!customer || !branch) {
            res.status(400).json({
                success: false,
                message: 'The selected customer or branch is inactive or does not belong together.'
            });
            return;
        }
        const ticketNumber = await generateTicketNumber();
        const ticket = await Ticket.create({
            ticketNumber,
            customerId,
            customerName: customer.name,
            branchId,
            branchName: branch.name,
            subject,
            category,
            reportedBy,
            contactEmail,
            contactPhone,
            assetReference,
            priority: priority,
            status: 'New',
            description,
            assignedTo: '',
            assignedRole: '',
            assignedEmployeeId: '',
            history: [{
                    type: 'created',
                    title: 'Ticket created',
                    description: 'The service request was submitted.',
                    actorName: getRequestSession(req)?.sub || reportedBy || 'Customer',
                    actorRole: getRequestSession(req)?.role || 'customer',
                    createdAt: new Date()
                }],
            attachments: []
        });
        res.status(201).json({
            success: true,
            message: 'Ticket created successfully.',
            ticket
        });
    }
    catch (error) {
        console.error('Create ticket error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create ticket.'
        });
    }
}
/* ============================================================
   GET TICKETS
   ============================================================ */
export async function getTickets(req, res) {
    try {
        const { customerId, branchId, status, priority } = req.query;
        const filter = {};
        const session = getRequestSession(req);
        if (session?.role === 'engineer') {
            if (!session.employeeId || !await isActiveEngineer(session.employeeId)) {
                res.status(403).json({ success: false, message: 'This engineer account is inactive.' });
                return;
            }
            filter['assignedEmployeeId'] = session.employeeId;
        }
        if (typeof customerId ===
            'string' &&
            customerId.trim()) {
            filter.customerId =
                customerId.trim();
        }
        if (typeof branchId ===
            'string' &&
            branchId.trim()) {
            filter.branchId =
                branchId.trim();
        }
        if (typeof status ===
            'string' &&
            status.trim()) {
            filter.status =
                status.trim();
        }
        if (typeof priority ===
            'string' &&
            priority.trim()) {
            filter.priority =
                priority.trim();
        }
        const tickets = await Ticket
            .find(filter)
            .sort({
            createdAt: -1
        });
        res.json({
            success: true,
            count: tickets.length,
            tickets
        });
    }
    catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load tickets.'
        });
    }
}
/* ============================================================
   GET SINGLE TICKET
   ============================================================ */
export async function getTicketById(req, res) {
    try {
        const ticketId = req.params['id'];
        if (!ticketId || !mongoose.isValidObjectId(ticketId)) {
            res.status(400).json({
                success: false,
                message: 'Ticket ID is required.'
            });
            return;
        }
        const ticket = await Ticket.findById(ticketId);
        const session = getRequestSession(req);
        if (session?.role === 'engineer' && (!session.employeeId || !await isActiveEngineer(session.employeeId))) {
            res.status(403).json({ success: false, message: 'This engineer account is inactive.' });
            return;
        }
        if (session?.role === 'engineer' && ticket?.assignedEmployeeId !== session.employeeId) {
            res.status(404).json({ success: false, message: 'Ticket not found.' });
            return;
        }
        if (!ticket) {
            res.status(404).json({
                success: false,
                message: 'Ticket not found.'
            });
            return;
        }
        res.json({
            success: true,
            ticket
        });
    }
    catch (error) {
        console.error('Get ticket error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load ticket.'
        });
    }
}
/* ============================================================
   UPDATE TICKET
   ============================================================ */
export async function updateTicket(req, res) {
    try {
        const ticketId = req.params['id'];
        if (!ticketId || !mongoose.isValidObjectId(ticketId)) {
            res.status(400).json({
                success: false,
                message: 'Ticket ID is required.'
            });
            return;
        }
        const requestBody = req.body;
        if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
            res.status(400).json({ success: false, message: 'Ticket update details are invalid.' });
            return;
        }
        const body = requestBody;
        const allowedFields = new Set([
            'subject', 'category', 'priority', 'status', 'description',
            'assignedEmployeeId', 'assignedTo', 'assignedRole'
        ]);
        if (Object.keys(body).length === 0 ||
            Object.keys(body).some((field) => !allowedFields.has(field))) {
            res.status(400).json({ success: false, message: 'Ticket update contains unsupported fields.' });
            return;
        }
        const allowedStatuses = ['New', 'Assigned', 'In Progress', 'On Hold', 'Resolved', 'Closed'];
        const allowedPriorities = ['Low', 'Medium', 'High', 'Critical'];
        if (body['status'] !== undefined && (typeof body['status'] !== 'string' ||
            !allowedStatuses.includes(body['status']))) {
            res.status(400).json({ success: false, message: 'Ticket status is invalid.' });
            return;
        }
        if (body['priority'] !== undefined && (typeof body['priority'] !== 'string' ||
            !allowedPriorities.includes(body['priority']))) {
            res.status(400).json({ success: false, message: 'Ticket priority is invalid.' });
            return;
        }
        const validOptionalText = (value, maxLength) => value === undefined ||
            (typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength);
        if (!validOptionalText(body['subject'], 160) ||
            !validOptionalText(body['category'], 100) ||
            !validOptionalText(body['description'], 5000)) {
            res.status(400).json({ success: false, message: 'Ticket details exceed the allowed length or are empty.' });
            return;
        }
        const session = getRequestSession(req);
        if (session?.role === 'engineer' && (!session.employeeId || !await isActiveEngineer(session.employeeId))) {
            res.status(403).json({ success: false, message: 'This engineer account is inactive.' });
            return;
        }
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
            res.status(404).json({ success: false, message: 'Ticket not found.' });
            return;
        }
        if (session?.role === 'engineer') {
            if (ticket.assignedEmployeeId !== session.employeeId) {
                res.status(404).json({ success: false, message: 'Ticket not found.' });
                return;
            }
            if (Object.keys(body).some((field) => field !== 'status') || typeof body['status'] !== 'string') {
                res.status(403).json({ success: false, message: 'Engineers can update ticket status only.' });
                return;
            }
            if (!['Assigned', 'In Progress', 'On Hold', 'Resolved'].includes(body['status'])) {
                res.status(400).json({ success: false, message: 'Choose a valid engineer status.' });
                return;
            }
        }
        const updateData = {};
        if (typeof body['subject'] === 'string')
            updateData.subject = body['subject'].trim();
        if (typeof body['category'] === 'string')
            updateData.category = body['category'].trim();
        if (typeof body['description'] === 'string')
            updateData.description = body['description'].trim();
        if (typeof body['priority'] === 'string')
            updateData.priority = body['priority'];
        if (typeof body['status'] === 'string')
            updateData.status = body['status'];
        if (session?.role === 'admin' && Object.hasOwn(body, 'assignedEmployeeId')) {
            const employeeId = typeof body['assignedEmployeeId'] === 'string' ? body['assignedEmployeeId'].trim() : null;
            if (employeeId === null || (employeeId && !mongoose.isValidObjectId(employeeId))) {
                res.status(400).json({ success: false, message: 'Choose a valid engineer.' });
                return;
            }
            if (employeeId) {
                const employee = await Employee.findOne({
                    _id: employeeId,
                    status: 'Active',
                    email: { $ne: '' },
                    passwordHash: { $ne: '' }
                }).select('name jobTitle officeBranchId').lean();
                const activeOffice = employee
                    ? await OfficeBranch.exists({ _id: employee.officeBranchId, status: 'Active' })
                    : null;
                if (!employee || !activeOffice) {
                    res.status(400).json({ success: false, message: 'Choose an active engineer with mobile access.' });
                    return;
                }
                updateData.assignedEmployeeId = employeeId;
                ticket.assignedTo = employee.name;
                ticket.assignedRole = employee.jobTitle || 'Engineer';
            }
            else {
                updateData.assignedEmployeeId = '';
                ticket.assignedTo = '';
                ticket.assignedRole = '';
            }
        }
        else if (Object.hasOwn(body, 'assignedEmployeeId')) {
            res.status(403).json({ success: false, message: 'Only administrators can assign tickets.' });
            return;
        }
        if (Object.hasOwn(body, 'assignedTo') || Object.hasOwn(body, 'assignedRole')) {
            res.status(400).json({ success: false, message: 'Assign tickets using a valid engineer account.' });
            return;
        }
        const actorName = session?.role === 'engineer' ? ticket.assignedTo : session?.sub;
        const actorRole = session?.role ?? 'system';
        const now = new Date();
        if (updateData.assignedEmployeeId !== undefined && updateData.assignedEmployeeId !== (ticket.assignedEmployeeId || '')) {
            if (updateData.assignedEmployeeId) {
                ticket.history.push({
                    type: 'assigned',
                    title: ticket.assignedEmployeeId ? 'Ticket reassigned' : 'Ticket assigned',
                    description: `Assigned to ${ticket.assignedTo}.`,
                    actorName: actorName || 'Administrator',
                    actorRole,
                    createdAt: now
                });
                if (ticket.status === 'New')
                    updateData.status = 'Assigned';
            }
            else {
                ticket.history.push({
                    type: 'unassigned',
                    title: 'Engineer unassigned',
                    description: 'The ticket was returned to the service queue.',
                    actorName: actorName || 'Administrator',
                    actorRole,
                    createdAt: now
                });
            }
        }
        const nextStatus = updateData.status;
        if (nextStatus && nextStatus !== ticket.status) {
            ticket.history.push({
                type: 'status_changed',
                title: `Status changed to ${nextStatus}`,
                description: `Ticket status changed from ${ticket.status} to ${nextStatus}.`,
                actorName: actorName || 'Administrator',
                actorRole,
                createdAt: now
            });
        }
        if (updateData.description !== undefined && updateData.description !== ticket.description) {
            ticket.history.push({
                type: 'updated',
                title: 'Ticket details updated',
                description: 'The ticket description was updated.',
                actorName: actorName || 'Administrator',
                actorRole,
                createdAt: now
            });
        }
        ticket.set(updateData);
        await ticket.save();
        res.json({ success: true, message: 'Ticket updated successfully.', ticket });
    }
    catch (error) {
        console.error('Update ticket error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update ticket.'
        });
    }
}
/* ============================================================
   DELETE TICKET
   ============================================================ */
export async function deleteTicket(req, res) {
    try {
        const ticketId = req.params['id'];
        if (!ticketId || !mongoose.isValidObjectId(ticketId)) {
            res.status(400).json({
                success: false,
                message: 'Ticket ID is required.'
            });
            return;
        }
        const ticket = await Ticket.findByIdAndDelete(ticketId);
        if (!ticket) {
            res.status(404).json({
                success: false,
                message: 'Ticket not found.'
            });
            return;
        }
        res.json({
            success: true,
            message: 'Ticket deleted successfully.'
        });
    }
    catch (error) {
        console.error('Delete ticket error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete ticket.'
        });
    }
}
