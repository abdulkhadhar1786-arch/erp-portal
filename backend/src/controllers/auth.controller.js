import { Branch } from '../models/Branch.js';
import { Customer } from '../models/Customer.js';
import { Employee } from '../models/Employee.js';
import { OfficeBranch } from '../models/OfficeBranch.js';
import { clearSessionCookie, getAuthConfig, getRequestSession, setSessionCookie, verifyCredentials } from '../middleware/auth.js';
import { verifyPassword } from '../utils/password.js';
export async function login(req, res) {
    const config = getAuthConfig();
    if (!config) {
        res.status(503).json({ success: false, message: 'Authentication is not configured on this server.' });
        return;
    }
    const body = req.body;
    if (typeof body?.username !== 'string' || !body.username.trim() ||
        typeof body.password !== 'string' || !body.password) {
        res.status(400).json({ success: false, message: 'Enter your email or username and password.' });
        return;
    }
    const username = body.username.trim();
    try {
        if (verifyCredentials(username, body.password, config)) {
            setSessionCookie(res, config, { sub: config.username, role: 'admin' });
            res.setHeader('Cache-Control', 'no-store');
            res.json({ success: true, username: config.username, role: 'admin' });
            return;
        }
        const normalizedLogin = username.toLowerCase();
        const [customers, branches, employees] = await Promise.all([
            Customer.find({
                status: 'Active',
                $or: [{ email: normalizedLogin }, { portalUsername: normalizedLogin }]
            }).select('+portalPasswordHash').limit(5),
            Branch.find({ username: normalizedLogin, status: 'Active' }).select('+passwordHash').limit(5),
            body.client === 'mobile'
                ? Employee.find({ email: normalizedLogin, status: 'Active', passwordHash: { $ne: '' } })
                    .select('+passwordHash').limit(5)
                : Promise.resolve([])
        ]);
        const matchingCustomers = [];
        for (const customer of customers) {
            if (customer.portalPasswordHash && await verifyPassword(body.password, customer.portalPasswordHash)) {
                matchingCustomers.push(customer);
            }
        }
        const matchingBranches = [];
        for (const branch of branches) {
            if (!branch.passwordHash || !(await verifyPassword(body.password, branch.passwordHash)))
                continue;
            const activeCustomer = await Customer.exists({ _id: branch.customerId, status: 'Active' });
            if (activeCustomer)
                matchingBranches.push(branch);
        }
        const matchingEmployees = [];
        for (const employee of employees) {
            if (!employee.passwordHash || !(await verifyPassword(body.password, employee.passwordHash)))
                continue;
            const activeOffice = await OfficeBranch.exists({ _id: employee.officeBranchId, status: 'Active' });
            if (activeOffice)
                matchingEmployees.push(employee);
        }
        if (matchingCustomers.length + matchingBranches.length + matchingEmployees.length > 1) {
            res.status(409).json({ success: false, message: 'This sign-in identifier matches multiple accounts. Contact your administrator.' });
            return;
        }
        if (matchingCustomers.length === 1) {
            const customer = matchingCustomers[0];
            const customerId = String(customer._id);
            setSessionCookie(res, config, {
                sub: customer.portalUsername || customer.email,
                role: 'customer_admin',
                customerId
            });
            res.setHeader('Cache-Control', 'no-store');
            res.json({ success: true, username: customer.portalUsername || customer.email, role: 'customer_admin', customerId });
            return;
        }
        if (matchingBranches.length === 1) {
            const branch = matchingBranches[0];
            const customerId = String(branch.customerId);
            const branchId = String(branch._id);
            setSessionCookie(res, config, {
                sub: branch.username,
                role: 'branch',
                customerId,
                branchId
            });
            res.setHeader('Cache-Control', 'no-store');
            res.json({ success: true, username: branch.username, role: 'branch', customerId, branchId });
            return;
        }
        if (matchingEmployees.length !== 1) {
            res.status(401).json({ success: false, message: 'Invalid email or username and password.' });
            return;
        }
        const employee = matchingEmployees[0];
        const employeeId = String(employee._id);
        const sessionToken = setSessionCookie(res, config, {
            sub: employee.email,
            role: 'engineer',
            employeeId
        });
        res.setHeader('Cache-Control', 'no-store');
        res.json({
            success: true,
            username: employee.email,
            role: 'engineer',
            employeeId,
            ...(body.client === 'mobile' ? { token: sessionToken } : {})
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(503).json({ success: false, message: 'Sign-in service is temporarily unavailable.' });
    }
}
export function getSession(req, res) {
    const session = getRequestSession(req);
    if (!session) {
        res.status(401).json({ success: false, message: 'Authentication is required.' });
        return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        success: true,
        username: session.sub,
        role: session.role,
        customerId: session.customerId,
        branchId: session.branchId,
        employeeId: session.employeeId
    });
}
export function logout(_req, res) {
    clearSessionCookie(res);
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).end();
}
