import { Types } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';

export function requireObjectId(value, label = 'id') {
    if (!Types.ObjectId.isValid(value)) {
        throw new AppError(`Invalid ${label}`, 400);
    }
    return new Types.ObjectId(value);
}

export function isObjectId(value) {
    return Types.ObjectId.isValid(value);
}

export function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getPagination(query) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

export function serialize(doc) {
    if (!doc) return doc;
    const value =
        typeof doc.toObject === 'function'
            ? doc.toObject({ virtuals: true, versionKey: false })
            : doc;
    return normalize(value);
}

export function serializeMany(docs = []) {
    return docs.map(serialize);
}

function normalize(value) {
    if (value instanceof Types.ObjectId) return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;

    const output = {};
    for (const [key, nested] of Object.entries(value)) {
        if (key === '__v') continue;
        output[key] = normalize(nested);
    }

    if (output._id && !output.id) {
        output.id = output._id;
    }

    return output;
}

export function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
}
