import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
    const value = String(password || '');
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await scrypt(value, salt, KEY_LENGTH);

    return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== 'string') return false;

    const [algorithm, salt, key] = storedHash.split(':');
    if (algorithm !== 'scrypt' || !salt || !key) return false;

    const derivedKey = await scrypt(String(password || ''), salt, KEY_LENGTH);
    const storedKey = Buffer.from(key, 'hex');

    if (storedKey.length !== derivedKey.length) return false;

    return crypto.timingSafeEqual(storedKey, derivedKey);
}
