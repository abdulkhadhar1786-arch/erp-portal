import mongoose from 'mongoose';
import { CodeCounter } from '../models/CodeCounter.js';
import { Employee } from '../models/Employee.js';
import { OfficeBranch } from '../models/OfficeBranch.js';
import { hashPassword } from '../utils/password.js';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function bodyOf(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function stringOf(body, field) {
    return typeof body[field] === 'string' ? body[field].trim() : undefined;
}
function validStatus(value) {
    return value === 'Active' || value === 'Inactive';
}
function validEmail(value) {
    return !value || emailPattern.test(value);
}
async function nextCode(counterId, prefix) {
    const counter = await CodeCounter.findByIdAndUpdate(counterId, { $inc: { sequence: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    return `${prefix}-${String(counter?.sequence ?? 1).padStart(4, '0')}`;
}
function handleError(res, error, message) {
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ success: false, message: 'Check the required fields and try again.' });
        return;
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        res.status(409).json({ success: false, message: 'That record code is already in use.' });
        return;
    }
    console.error(message, error);
    res.status(500).json({ success: false, message });
}
export async function getOfficeBranches(_req, res) {
    try {
        const [offices, counts] = await Promise.all([
            OfficeBranch.find().sort({ name: 1 }).lean(),
            Employee.aggregate([{ $group: { _id: '$officeBranchId', count: { $sum: 1 } } }])
        ]);
        const countByOffice = new Map(counts.map((item) => [String(item._id), item.count]));
        const branchOffices = offices.map((office) => ({
            ...office,
            _id: String(office._id),
            employeeCount: countByOffice.get(String(office._id)) ?? 0
        }));
        res.json({ success: true, count: branchOffices.length, branchOffices });
    }
    catch (error) {
        handleError(res, error, 'Failed to load branch offices.');
    }
}
export async function createOfficeBranch(req, res) {
    const body = bodyOf(req.body);
    if (!body) {
        res.status(400).json({ success: false, message: 'Branch office details are required.' });
        return;
    }
    const name = stringOf(body, 'name');
    const email = stringOf(body, 'email') ?? '';
    const status = body['status'] === undefined ? 'Active' : body['status'];
    if (!name || !validStatus(status) || !validEmail(email)) {
        res.status(400).json({ success: false, message: 'Enter a branch office name and valid contact details.' });
        return;
    }
    try {
        const officeBranch = await OfficeBranch.create({
            code: await nextCode('office-branch', 'OFF'),
            name,
            email,
            phone: stringOf(body, 'phone') ?? '',
            address: stringOf(body, 'address') ?? '',
            city: stringOf(body, 'city') ?? '',
            state: stringOf(body, 'state') ?? '',
            status
        });
        res.status(201).json({
            success: true,
            message: 'Branch office created.',
            officeBranch: { ...officeBranch.toObject(), _id: String(officeBranch._id), employeeCount: 0 }
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to create branch office.');
    }
}
export async function getOfficeBranch(req, res) {
    const id = req.params['id'];
    if (!id || !mongoose.isValidObjectId(id)) {
        res.status(400).json({ success: false, message: 'Branch office ID is invalid.' });
        return;
    }
    try {
        const officeBranch = await OfficeBranch.findById(id).lean();
        if (!officeBranch) {
            res.status(404).json({ success: false, message: 'Branch office not found.' });
            return;
        }
        const employeeCount = await Employee.countDocuments({ officeBranchId: id });
        res.json({ success: true, officeBranch: { ...officeBranch, _id: String(officeBranch._id), employeeCount } });
    }
    catch (error) {
        handleError(res, error, 'Failed to load branch office.');
    }
}
export async function updateOfficeBranch(req, res) {
    const id = req.params['id'];
    const body = bodyOf(req.body);
    if (!id || !mongoose.isValidObjectId(id) || !body) {
        res.status(400).json({ success: false, message: 'Branch office details are invalid.' });
        return;
    }
    const update = {};
    for (const field of ['name', 'email', 'phone', 'address', 'city', 'state']) {
        const value = stringOf(body, field);
        if (value !== undefined)
            update[field] = value;
    }
    if (body['status'] !== undefined) {
        if (!validStatus(body['status'])) {
            res.status(400).json({ success: false, message: 'Branch office status is invalid.' });
            return;
        }
        update['status'] = body['status'];
    }
    if (!Object.keys(update).length || update['name'] === '' || !validEmail(update['email'] ?? '')) {
        res.status(400).json({ success: false, message: 'Provide valid branch office fields.' });
        return;
    }
    try {
        const officeBranch = await OfficeBranch.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
        if (!officeBranch) {
            res.status(404).json({ success: false, message: 'Branch office not found.' });
            return;
        }
        const employeeCount = await Employee.countDocuments({ officeBranchId: id });
        res.json({ success: true, message: 'Branch office updated.', officeBranch: { ...officeBranch.toObject(), employeeCount } });
    }
    catch (error) {
        handleError(res, error, 'Failed to update branch office.');
    }
}
export async function getEmployees(_req, res) {
    try {
        const employees = await Employee.find().select('+passwordHash').sort({ name: 1 }).lean();
        const officeIds = [...new Set(employees.map((employee) => String(employee.officeBranchId)))];
        const offices = officeIds.length
            ? await OfficeBranch.find({ _id: { $in: officeIds } }).select('name code').lean()
            : [];
        const officeById = new Map(offices.map((office) => [String(office._id), office]));
        const result = employees.map((employee) => {
            const officeId = String(employee.officeBranchId);
            const office = officeById.get(officeId);
            const { passwordHash, ...publicEmployee } = employee;
            return {
                ...publicEmployee,
                _id: String(employee._id),
                officeBranchId: officeId,
                officeBranchName: office?.name ?? 'Office not found',
                officeBranchCode: office?.code ?? '',
                canLogin: Boolean(passwordHash)
            };
        });
        res.json({ success: true, count: result.length, employees: result });
    }
    catch (error) {
        handleError(res, error, 'Failed to load employees.');
    }
}
export async function createEmployee(req, res) {
    const body = bodyOf(req.body);
    if (!body) {
        res.status(400).json({ success: false, message: 'Employee details are required.' });
        return;
    }
    const name = stringOf(body, 'name');
    const email = (stringOf(body, 'email') ?? '').toLowerCase();
    const password = typeof body['password'] === 'string' ? body['password'] : '';
    const officeBranchId = stringOf(body, 'officeBranchId');
    const status = body['status'] === undefined ? 'Active' : body['status'];
    if (!name || !officeBranchId || !mongoose.isValidObjectId(officeBranchId) || !validStatus(status) || !validEmail(email)) {
        res.status(400).json({ success: false, message: 'Enter an employee name, office branch, and valid contact details.' });
        return;
    }
    if (password && (password.length < 8 || !email)) {
        res.status(400).json({ success: false, message: 'Engineer access requires a work email and a password of at least 8 characters.' });
        return;
    }
    try {
        if (email && await Employee.exists({ email })) {
            res.status(409).json({ success: false, message: 'That work email is already in use.' });
            return;
        }
        const officeBranch = await OfficeBranch.findOne({ _id: officeBranchId, status: 'Active' }).select('_id name code');
        if (!officeBranch) {
            res.status(400).json({ success: false, message: 'Choose an active branch office.' });
            return;
        }
        const hireDateValue = stringOf(body, 'hireDate');
        const hireDate = hireDateValue ? new Date(hireDateValue) : null;
        if (hireDate && Number.isNaN(hireDate.getTime())) {
            res.status(400).json({ success: false, message: 'Hire date is invalid.' });
            return;
        }
        const employee = await Employee.create({
            code: await nextCode('employee', 'EMP'),
            name,
            email,
            ...(password ? { passwordHash: await hashPassword(password) } : {}),
            phone: stringOf(body, 'phone') ?? '',
            jobTitle: stringOf(body, 'jobTitle') ?? '',
            department: stringOf(body, 'department') ?? '',
            officeBranchId,
            hireDate,
            status
        });
        const { passwordHash: _passwordHash, ...publicEmployee } = employee.toObject();
        res.status(201).json({
            success: true,
            message: 'Employee created.',
            employee: {
                ...publicEmployee,
                _id: String(employee._id),
                officeBranchId: String(employee.officeBranchId),
                officeBranchName: officeBranch.name,
                officeBranchCode: officeBranch.code,
                canLogin: Boolean(password)
            }
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to create employee.');
    }
}
export async function getEmployee(req, res) {
    const id = req.params['id'];
    if (!id || !mongoose.isValidObjectId(id)) {
        res.status(400).json({ success: false, message: 'Employee ID is invalid.' });
        return;
    }
    try {
        const employee = await Employee.findById(id).select('+passwordHash').lean();
        if (!employee) {
            res.status(404).json({ success: false, message: 'Employee not found.' });
            return;
        }
        const office = await OfficeBranch.findById(employee.officeBranchId).select('name code').lean();
        const { passwordHash, ...publicEmployee } = employee;
        res.json({
            success: true,
            employee: {
                ...publicEmployee,
                _id: String(employee._id),
                officeBranchId: String(employee.officeBranchId),
                officeBranchName: office?.name ?? 'Office not found',
                officeBranchCode: office?.code ?? '',
                canLogin: Boolean(passwordHash)
            }
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to load employee.');
    }
}
export async function updateEmployee(req, res) {
    const id = req.params['id'];
    const body = bodyOf(req.body);
    if (!id || !mongoose.isValidObjectId(id) || !body) {
        res.status(400).json({ success: false, message: 'Employee details are invalid.' });
        return;
    }
    const update = {};
    const currentEmployee = await Employee.findById(id).select('officeBranchId email +passwordHash').lean();
    if (!currentEmployee) {
        res.status(404).json({ success: false, message: 'Employee not found.' });
        return;
    }
    for (const field of ['name', 'email', 'phone', 'jobTitle', 'department']) {
        const value = stringOf(body, field);
        if (value !== undefined)
            update[field] = field === 'email' ? value.toLowerCase() : value;
    }
    const newPassword = typeof body['password'] === 'string' ? body['password'] : '';
    const finalEmail = String(update['email'] ?? currentEmployee.email ?? '').toLowerCase();
    if (newPassword && (newPassword.length < 8 || !finalEmail)) {
        res.status(400).json({ success: false, message: 'Engineer access requires a work email and a password of at least 8 characters.' });
        return;
    }
    if (!finalEmail && (currentEmployee.passwordHash || newPassword)) {
        res.status(400).json({ success: false, message: 'A work email is required while engineer access is enabled.' });
        return;
    }
    if (finalEmail && finalEmail !== currentEmployee.email && await Employee.exists({ email: finalEmail, _id: { $ne: id } })) {
        res.status(409).json({ success: false, message: 'That work email is already in use.' });
        return;
    }
    if (newPassword)
        update['passwordHash'] = await hashPassword(newPassword);
    if (body['officeBranchId'] !== undefined) {
        const officeId = stringOf(body, 'officeBranchId');
        const isCurrentOffice = officeId === String(currentEmployee.officeBranchId);
        if (!officeId || !mongoose.isValidObjectId(officeId) || (!isCurrentOffice && !await OfficeBranch.exists({ _id: officeId, status: 'Active' }))) {
            res.status(400).json({ success: false, message: 'Choose an active branch office.' });
            return;
        }
        update['officeBranchId'] = officeId;
    }
    if (body['hireDate'] !== undefined) {
        const dateValue = stringOf(body, 'hireDate');
        const date = dateValue ? new Date(dateValue) : null;
        if (date && Number.isNaN(date.getTime())) {
            res.status(400).json({ success: false, message: 'Hire date is invalid.' });
            return;
        }
        update['hireDate'] = date;
    }
    if (body['status'] !== undefined) {
        if (!validStatus(body['status'])) {
            res.status(400).json({ success: false, message: 'Employee status is invalid.' });
            return;
        }
        update['status'] = body['status'];
    }
    if (!Object.keys(update).length || update['name'] === '' || !validEmail(String(update['email'] ?? ''))) {
        res.status(400).json({ success: false, message: 'Provide valid employee fields.' });
        return;
    }
    try {
        const employee = await Employee.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
            .select('+passwordHash').lean();
        if (!employee) {
            res.status(404).json({ success: false, message: 'Employee not found.' });
            return;
        }
        const { passwordHash, ...publicEmployee } = employee;
        const office = await OfficeBranch.findById(employee.officeBranchId).select('name code').lean();
        res.json({
            success: true,
            message: 'Employee updated.',
            employee: {
                ...publicEmployee,
                _id: String(employee._id),
                officeBranchId: String(employee.officeBranchId),
                officeBranchName: office?.name ?? 'Office not found',
                officeBranchCode: office?.code ?? '',
                canLogin: Boolean(passwordHash)
            }
        });
    }
    catch (error) {
        handleError(res, error, 'Failed to update employee.');
    }
}
