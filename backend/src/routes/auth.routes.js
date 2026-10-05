import { Router } from 'express';
import { getSession, login, logout } from '../controllers/auth.controller.js';
import { requireSession } from '../middleware/auth.js';
const router = Router();
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 10;
const loginAttempts = new Map();
function limitLoginAttempts(req, res, next) {
    const now = Date.now();
    const client = req.ip ?? 'unknown';
    let attempts = loginAttempts.get(client);
    if (loginAttempts.size >= 5000) {
        for (const [key, record] of loginAttempts) {
            if (record.resetAt <= now) {
                loginAttempts.delete(key);
            }
        }
    }
    if (!attempts || attempts.resetAt <= now) {
        if (loginAttempts.size >= 5000) {
            res.setHeader('Retry-After', '60');
            res.status(429).json({
                success: false,
                message: 'Login is temporarily busy. Try again later.'
            });
            return;
        }
        attempts = { count: 0, resetAt: now + loginWindowMs };
        loginAttempts.set(client, attempts);
    }
    if (attempts.count >= maxLoginAttempts) {
        res.setHeader('Retry-After', Math.ceil((attempts.resetAt - now) / 1000));
        res.status(429).json({
            success: false,
            message: 'Too many login attempts. Try again later.'
        });
        return;
    }
    attempts.count += 1;
    next();
}
router.post('/login', limitLoginAttempts, login);
router.get('/session', requireSession, getSession);
router.post('/logout', logout);
export default router;
