import mongoose from '../config/mongodb.js';
import { AppError } from '../middleware/errorHandler.js';
import { escapeRegex } from './mongo.js';

export const APPOINTMENT_STATUSES = Object.freeze([
    'scheduled',
    'confirmed',
    'waiting',
    'called',
    'in_consultation',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled',
]);

export const QUEUE_STATUSES = Object.freeze([
    'waiting',
    'called',
    'in_consultation',
    'completed',
    'no_show',
]);

const STATUS_ALIASES = Object.freeze({
    'in-progress': 'in_consultation',
    in_progress: 'in_consultation',
    inprogress: 'in_consultation',
    'no-show': 'no_show',
    noshow: 'no_show',
});

export function normalizeStatus(value, allowed = APPOINTMENT_STATUSES) {
    if (value === undefined || value === null || value === '') return undefined;
    const key = String(value).trim().toLowerCase().replace(/\s+/g, '_');
    const normalized = STATUS_ALIASES[key] || key;

    if (!allowed.includes(normalized)) {
        throw new AppError(`Invalid status. Use one of: ${allowed.join(', ')}`, 400);
    }

    return normalized;
}

export function normalizeStatusValue(value) {
    if (value === undefined || value === null || value === '') return value;
    const key = String(value).trim().toLowerCase().replace(/\s+/g, '_');
    return STATUS_ALIASES[key] || key;
}

export function getListOptions(query = {}) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
    const offset =
        query.offset !== undefined
            ? Math.max(parseInt(query.offset, 10) || 0, 0)
            : undefined;
    const page =
        offset !== undefined
            ? Math.max(Math.floor(offset / limit) + 1, 1)
            : Math.max(parseInt(query.page, 10) || 1, 1);
    const skip = offset !== undefined ? offset : (page - 1) * limit;

    return { page, limit, skip };
}

export function getPaginationMeta({ page, limit, total }) {
    return {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
    };
}

export function parseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

export function objectId(value) {
    if (!value) return value;
    return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : value;
}

export function createFieldMapper(fieldMap = {}) {
    return (field) => {
        if (!field) return field;
        if (field === 'id') return '_id';
        return fieldMap[field] || field;
    };
}

function coerceFilterValue(field, value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (field === '_id' || field.endsWith('_id')) return objectId(value);
    return value;
}

function addCondition(filter, field, condition) {
    if (filter[field] && typeof filter[field] === 'object' && !Array.isArray(filter[field])) {
        filter[field] = { ...filter[field], ...condition };
    } else {
        filter[field] = condition;
    }
}

function statusFilterValue(value, allowed) {
    const normalized = normalizeStatus(value, allowed);
    if (normalized === 'in_consultation') return { $in: ['in_consultation', 'in-progress', 'in_progress'] };
    if (normalized === 'no_show') return { $in: ['no_show', 'no-show'] };
    return normalized;
}

export function applyCompatibilityFilters(filter, query, {
    fieldMap = {},
    allowedRegexFields = [],
    statusAllowed = APPOINTMENT_STATUSES,
} = {}) {
    const mapField = createFieldMapper(fieldMap);

    for (const item of parseJson(query.filters, [])) {
        const field = mapField(item.column);
        const value = coerceFilterValue(field, item.value);

        switch (item.op) {
            case 'eq':
                filter[field] = field === 'status' ? statusFilterValue(item.value, statusAllowed) : value;
                break;
            case 'neq':
                filter[field] = { $ne: value };
                break;
            case 'gt':
                addCondition(filter, field, { $gt: value });
                break;
            case 'gte':
                addCondition(filter, field, { $gte: value });
                break;
            case 'lt':
                addCondition(filter, field, { $lt: value });
                break;
            case 'lte':
                addCondition(filter, field, { $lte: value });
                break;
            case 'in':
                filter[field] = {
                    $in: Array.isArray(item.value)
                        ? item.value.map((entry) => coerceFilterValue(field, entry))
                        : [],
                };
                break;
            case 'ilike':
                if (allowedRegexFields.includes(field)) {
                    filter[field] = new RegExp(`^${escapeRegex(String(item.value).replaceAll('%', ''))}`, 'i');
                }
                break;
            default:
                break;
        }
    }

    return filter;
}

export function buildListFilter(req, {
    fieldMap = {},
    allowedRegexFields = [],
    searchFields = [],
    statusAllowed = APPOINTMENT_STATUSES,
} = {}) {
    const mapField = createFieldMapper(fieldMap);
    const filter = {};

    applyCompatibilityFilters(filter, req.query, { fieldMap, allowedRegexFields, statusAllowed });

    for (const key of ['status', 'date', 'doctor_id', 'patient_id']) {
        if (!req.query[key]) continue;
        const field = mapField(key);
        filter[field] = key === 'status'
            ? statusFilterValue(req.query[key], statusAllowed)
            : coerceFilterValue(field, req.query[key]);
    }

    if (req.query.doctorId && !filter[mapField('doctor_id')]) {
        filter[mapField('doctor_id')] = objectId(req.query.doctorId);
    }
    if (req.query.patientId && !filter[mapField('patient_id')]) {
        filter[mapField('patient_id')] = objectId(req.query.patientId);
    }

    const search = String(req.query.search || '').trim();
    if (search && searchFields.length > 0) {
        const rx = new RegExp(`^${escapeRegex(search)}`, 'i');
        filter.$or = searchFields.map((field) => ({ [mapField(field)]: rx }));
    }

    return filter;
}

export function buildSort(query = {}, {
    fieldMap = {},
    allowed = [],
    fallback = { created_at: -1 },
} = {}) {
    const mapField = createFieldMapper(fieldMap);
    const sort = {};

    for (const order of parseJson(query.orders, [])) {
        const field = mapField(order.column);
        if (!allowed.length || allowed.includes(field)) {
            sort[field] = order.ascending === false ? -1 : 1;
        }
    }

    const requested = String(query.sort || '').trim();
    if (requested) {
        for (const part of requested.split(',').map((item) => item.trim()).filter(Boolean)) {
            const direction = part.startsWith('-') ? -1 : 1;
            const field = mapField(part.replace(/^-/, ''));
            if (!allowed.length || allowed.includes(field)) sort[field] = direction;
        }
    }

    return Object.keys(sort).length ? sort : fallback;
}

export function buildProjection(query = {}, allowed = [], fieldMap = {}) {
    const raw = String(query.fields || query.select || '').trim();
    if (!raw) return '';
    const mapField = createFieldMapper(fieldMap);

    const requested = raw
        .split(',')
        .map((field) => mapField(field.trim()))
        .filter(Boolean);

    const fields = allowed.length
        ? requested.filter((field) => allowed.includes(field) || allowed.includes(field.replace(/^id$/, '_id')))
        : requested;

    return fields.join(' ');
}

export async function pagedFind(model, filter, {
    page,
    limit,
    skip,
    sort,
    projection = '',
    populate,
    maxTimeMS = 5000,
}) {
    let cursor = model.find(filter);
    if (projection) cursor = cursor.select(projection);
    if (populate) cursor = cursor.populate(populate);

    const [items, total] = await Promise.all([
        cursor
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .maxTimeMS(maxTimeMS)
            .lean({ virtuals: true }),
        model.countDocuments(filter).maxTimeMS(maxTimeMS),
    ]);

    return {
        items,
        pagination: getPaginationMeta({ page, limit, total }),
    };
}
