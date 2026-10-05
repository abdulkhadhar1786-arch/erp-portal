import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scryptAsync = promisify(scrypt);
export async function hashPassword(password) {
    const salt = randomBytes(16);
    const key = await scryptAsync(password, salt, 64);
    return `${salt.toString('hex')}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
    const [saltHex, keyHex, extra] = encoded.split(':');
    if (!saltHex || !keyHex || extra !== undefined ||
        !/^[0-9a-f]{32}$/i.test(saltHex) ||
        !/^[0-9a-f]{128}$/i.test(keyHex)) {
        return false;
    }
    const expected = Buffer.from(keyHex, 'hex');
    const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), 64);
    return timingSafeEqual(actual, expected);
}
