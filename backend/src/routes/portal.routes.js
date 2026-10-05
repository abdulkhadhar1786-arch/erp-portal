import { Router } from 'express';
import { createPortalTicket, getPortalDashboard, getPortalTicket, getPortalTickets } from '../controllers/portal.controller.js';
import { getRequestSession, requireRole, requireSession } from '../middleware/auth.js';
import { Branch } from '../models/Branch.js';
import { Customer } from '../models/Customer.js';
const router = Router();
router.use(requireSession);
async function requireActiveAccount(req, res, next) {
    const session = getRequestSession(req);
    if (!session?.customerId) {
        res.status(401).json({ success: false, message: 'Authentication is required.' });
        return;
    }
    try {
        const customer = await Customer.exists({ _id: session.customerId, status: 'Active' });
        const branch = session.role === 'branch' && session.branchId
            ? await Branch.exists({ _id: session.branchId, customerId: session.customerId, status: 'Active' })
            : true;
        if (!customer || !branch) {
            res.status(403).json({ success: false, message: 'This portal account is inactive.' });
            return;
        }
        next();
    }
    catch {
        res.status(503).json({ success: false, message: 'Portal service is temporarily unavailable.' });
    }
}
router.use('/customer', requireRole('customer_admin'), requireActiveAccount);
router.use('/branch', requireRole('branch'), requireActiveAccount);
router.get('/customer/dashboard', getPortalDashboard);
router.get('/customer/tickets', getPortalTickets);
router.get('/customer/tickets/:id', getPortalTicket);
router.post('/customer/tickets', createPortalTicket);
router.get('/branch/dashboard', getPortalDashboard);
router.get('/branch/tickets', getPortalTickets);
router.get('/branch/tickets/:id', getPortalTicket);
router.post('/branch/tickets', createPortalTicket);
export default router;
