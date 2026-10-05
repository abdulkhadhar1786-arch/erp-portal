import mongoose from 'mongoose';
import { Branch } from '../models/Branch.js';
import { Customer } from '../models/Customer.js';
import { Ticket } from '../models/Ticket.js';
import { getRequestSession } from '../middleware/auth.js';
import { generateTicketNumber } from './ticket.controller.js';
const openStatuses = { $nin: ['Resolved', 'Closed'] };
const priorities = ['Low', 'Medium', 'High', 'Critical'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function portalTicketRecord(ticket) {
    return {
        ...ticket,
        history: (ticket.history ?? []).map((event) => ({
            ...event,
            actorName: event.actorRole === 'customer_admin' || event.actorRole === 'branch'
                ? 'Requester'
                : 'Service desk',
            description: event.type === 'assigned'
                ? 'A service engineer was assigned to this ticket.'
                : event.type === 'unassigned'
                    ? 'The ticket was returned to the service queue.'
                    : event.description
        }))
    };
}
function sendUnavailable(res) {
    res.status(401).json({ success: false, message: 'This portal account is unavailable.' });
}
export async function getPortalDashboard(req, res) {
    const session = getRequestSession(req);
    if (!session?.customerId) {
        sendUnavailable(res);
        return;
    }
    try {
        if (session.role === 'customer_admin') {
            const customer = await Customer.findOne({ _id: session.customerId, status: 'Active' })
                .select('code name email phone contactPerson industry website city address status portalUsername').lean();
            if (!customer) {
                sendUnavailable(res);
                return;
            }
            const [branches, totalTickets, openTickets, recentTickets] = await Promise.all([
                Branch.find({ customerId: session.customerId }).select('code name city status').sort({ name: 1 }).lean(),
                Ticket.countDocuments({ customerId: session.customerId }),
                Ticket.countDocuments({ customerId: session.customerId, status: openStatuses }),
                Ticket.find({ customerId: session.customerId }).sort({ createdAt: -1 }).limit(6).lean()
            ]);
            res.json({
                success: true,
                role: session.role,
                account: { ...customer, _id: String(customer._id) },
                stats: { totalTickets, openTickets, branchCount: branches.length },
                branches: branches.map((branch) => ({ ...branch, _id: String(branch._id) })),
                recentTickets: recentTickets.map(portalTicketRecord)
            });
            return;
        }
        if (session.role !== 'branch' || !session.branchId) {
            sendUnavailable(res);
            return;
        }
        const [branch, customer] = await Promise.all([
            Branch.findOne({ _id: session.branchId, customerId: session.customerId, status: 'Active' })
                .select('code name phone email address city state pincode status username').lean(),
            Customer.findOne({ _id: session.customerId, status: 'Active' }).select('name code').lean()
        ]);
        if (!branch || !customer) {
            sendUnavailable(res);
            return;
        }
        const branchId = String(branch._id);
        const [totalTickets, openTickets, recentTickets] = await Promise.all([
            Ticket.countDocuments({ customerId: session.customerId, branchId }),
            Ticket.countDocuments({ customerId: session.customerId, branchId, status: openStatuses }),
            Ticket.find({ customerId: session.customerId, branchId }).sort({ createdAt: -1 }).limit(6).lean()
        ]);
        res.json({
            success: true,
            role: session.role,
            account: { ...branch, _id: branchId, customer: customer.name, customerCode: customer.code },
            stats: { totalTickets, openTickets },
            recentTickets: recentTickets.map(portalTicketRecord)
        });
    }
    catch (error) {
        console.error('Portal dashboard error:', error);
        res.status(500).json({ success: false, message: 'Failed to load portal dashboard.' });
    }
}
export async function getPortalTickets(req, res) {
    const session = getRequestSession(req);
    if (!session?.customerId) {
        sendUnavailable(res);
        return;
    }
    const filter = { customerId: session.customerId };
    if (session.role === 'branch') {
        if (!session.branchId) {
            sendUnavailable(res);
            return;
        }
        filter['branchId'] = session.branchId;
    }
    try {
        const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).lean();
        res.json({ success: true, count: tickets.length, tickets: tickets.map(portalTicketRecord) });
    }
    catch (error) {
        console.error('Portal tickets error:', error);
        res.status(500).json({ success: false, message: 'Failed to load tickets.' });
    }
}
export async function getPortalTicket(req, res) {
    const session = getRequestSession(req);
    const ticketId = req.params['id'];
    if (!session?.customerId || typeof ticketId !== 'string' || !mongoose.isValidObjectId(ticketId)) {
        res.status(400).json({ success: false, message: 'Ticket ID is invalid.' });
        return;
    }
    if (session.role === 'branch' && !session.branchId) {
        sendUnavailable(res);
        return;
    }
    const filter = { _id: ticketId, customerId: session.customerId };
    if (session.role === 'branch')
        filter['branchId'] = session.branchId;
    try {
        const ticket = await Ticket.findOne(filter).lean();
        if (!ticket) {
            res.status(404).json({ success: false, message: 'Ticket not found.' });
            return;
        }
        res.json({ success: true, ticket: portalTicketRecord(ticket) });
    }
    catch (error) {
        console.error('Portal ticket detail error:', error);
        res.status(500).json({ success: false, message: 'Failed to load ticket.' });
    }
}
export async function createPortalTicket(req, res) {
    const session = getRequestSession(req);
    if (!session?.customerId) {
        sendUnavailable(res);
        return;
    }
    const body = req.body;
    const subject = typeof body?.['subject'] === 'string' ? body['subject'].trim() : '';
    const category = typeof body?.['category'] === 'string' ? body['category'].trim() : '';
    const description = typeof body?.['description'] === 'string' ? body['description'].trim() : '';
    const reportedBy = typeof body?.['reportedBy'] === 'string' ? body['reportedBy'].trim() : '';
    const contactEmail = typeof body?.['contactEmail'] === 'string' ? body['contactEmail'].trim() : '';
    const contactPhone = typeof body?.['contactPhone'] === 'string' ? body['contactPhone'].trim() : '';
    const assetReference = typeof body?.['assetReference'] === 'string' ? body['assetReference'].trim() : '';
    const submittedBranchId = typeof body?.['branchId'] === 'string' ? body['branchId'] : '';
    const priority = body?.['priority'] === undefined ? 'Medium' : body['priority'];
    if (!subject || !category || !description || subject.length > 160 || description.length > 5000 ||
        reportedBy.length > 120 || contactEmail.length > 254 ||
        (contactEmail !== '' && !emailPattern.test(contactEmail)) ||
        contactPhone.length > 40 || assetReference.length > 160 ||
        typeof priority !== 'string' || !priorities.includes(priority)) {
        res.status(400).json({ success: false, message: 'Enter valid ticket details and requester contact information.' });
        return;
    }
    const branchId = session.role === 'branch' ? session.branchId : submittedBranchId;
    if (!branchId || !mongoose.isValidObjectId(branchId)) {
        res.status(400).json({ success: false, message: 'Select a valid branch.' });
        return;
    }
    try {
        const [customer, branch] = await Promise.all([
            Customer.findOne({ _id: session.customerId, status: 'Active' }).select('name').lean(),
            Branch.findOne({ _id: branchId, customerId: session.customerId, status: 'Active' }).select('name').lean()
        ]);
        if (!customer || !branch) {
            res.status(400).json({ success: false, message: 'The selected customer or branch is unavailable.' });
            return;
        }
        const ticket = await Ticket.create({
            ticketNumber: await generateTicketNumber(),
            customerId: session.customerId,
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
                    actorName: session.role === 'branch' ? 'Requester' : 'Customer administrator',
                    actorRole: session.role,
                    createdAt: new Date()
                }],
            attachments: []
        });
        res.status(201).json({ success: true, message: 'Ticket created successfully.', ticket });
    }
    catch (error) {
        console.error('Portal create ticket error:', error);
        res.status(500).json({ success: false, message: 'Failed to create ticket.' });
    }
}
