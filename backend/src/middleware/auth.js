import { createHmac, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
const SESSION_COOKIE = 'service_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
export function getAuthConfig() {
    const username = process.env['ADMIN_USERNAME']?.trim();
    const password = process.env['ADMIN_PASSWORD'];
    const secret = process.env['AUTH_SECRET'];
    if (!username ||
        !password ||
        password.length < 8 ||
        password.startsWith('replace-with-') ||
        !secret ||
        secret.length < 24 ||
        secret.startsWith('replace-with-')) {
        return null;
    }
    return { username, password, secret };
}
function sign(payload, secret) {
    return createHmac('sha256', secret)
        .update(payload)
        .digest('base64url');
}
function createSession(claims, secret) {
    const payload = Buffer.from(JSON.stringify({
        ...claims,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    })).toString('base64url');
    return `${payload}.${sign(payload, secret)}`;
}
function getCookie(req) {
    const cookies = req.headers.cookie?.split(';') ?? [];
    const value = cookies
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
        ?.slice(SESSION_COOKIE.length + 1);
    return value || undefined;
}
function verifySession(token, config) {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined)
        return null;
    const expected = Buffer.from(sign(payload, config.secret));
    const received = Buffer.from(signature);
    if (received.length !== expected.length ||
        !timingSafeEqual(received, expected))
        return null;
    try {
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (typeof decoded.sub !== 'string' ||
            typeof decoded.exp !== 'number' ||
            decoded.exp <= Math.floor(Date.now() / 1000))
            return null;
        const role = decoded.role ?? (decoded.sub === config.username ? 'admin' : undefined);
        if (role === 'admin' && decoded.sub === config.username) {
            return { sub: decoded.sub, exp: decoded.exp, role };
        }
        if (role === 'customer_admin' &&
            typeof decoded.customerId === 'string' &&
            mongoose.isValidObjectId(decoded.customerId)) {
            return {
                sub: decoded.sub,
                exp: decoded.exp,
                role,
                customerId: decoded.customerId
            };
        }
        if (role === 'branch' &&
            typeof decoded.customerId === 'string' &&
            mongoose.isValidObjectId(decoded.customerId) &&
            typeof decoded.branchId === 'string' &&
            mongoose.isValidObjectId(decoded.branchId)) {
            return {
                sub: decoded.sub,
                exp: decoded.exp,
                role,
                customerId: decoded.customerId,
                branchId: decoded.branchId
            };
        }
        if (role === 'engineer' &&
            typeof decoded.employeeId === 'string' &&
            mongoose.isValidObjectId(decoded.employeeId)) {
            return {
                sub: decoded.sub,
                exp: decoded.exp,
                role,
                employeeId: decoded.employeeId
            };
        }
        return null;
    }
    catch {
        return null;
    }
}
function cookieOptions() {
    const production = process.env['NODE_ENV'] === 'production';
    // The Angular frontend and API are on different Azure sites
    // (azurestaticapps.net vs azurewebsites.net), so Strict cookies are
    // not sent with credentialed cross-site XHR/fetch requests.
    const sameSite = production ? 'None' : 'Lax';
    const secure = production ? '; Secure' : '';
    return `Path=/api; HttpOnly; SameSite=${sameSite}${secure}`;
}
export function setSessionCookie(res, config, claims) {
    const token = createSession(claims, config.secret);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieOptions()}; Max-Age=${SESSION_TTL_SECONDS}`);
    return token;
}
export function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieOptions()}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}
export function getRequestSession(req) {
    return req.authSession;
}
export function requireSession(req, res, next) {
    const config = getAuthConfig();
    if (!config) {
        res.status(503).json({ success: false, message: 'Authentication is not configured on this server.' });
        return;
    }
    const authorization = req.get('authorization');
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    const token = bearerToken ?? getCookie(req);
    const session = token ? verifySession(token, config) : null;
    if (!session) {
        res.status(401).json({ success: false, message: 'Authentication is required.' });
        return;
    }
    req.authSession = session;
    next();
}
export function requireRole(...roles) {
    return (req, res, next) => {
        const session = getRequestSession(req);
        if (!session || !roles.includes(session.role)) {
            res.status(403).json({ success: false, message: 'This account cannot access this resource.' });
            return;
        }
        next();
    };
}
export function requireAuth(req, res, next) {
    requireSession(req, res, () => requireRole('admin')(req, res, next));
}
export function verifyCredentials(username, password, config) {
    const submittedUsername = Buffer.from(username.trim());
    const expectedUsername = Buffer.from(config.username);
    const submittedPassword = createHmac('sha256', config.secret)
        .update(password)
        .digest();
    const expectedPassword = createHmac('sha256', config.secret)
        .update(config.password)
        .digest();
    const usernameMatches = submittedUsername.length === expectedUsername.length &&
        timingSafeEqual(submittedUsername, expectedUsername);
    return usernameMatches && timingSafeEqual(submittedPassword, expectedPassword);
}
