import express from 'express';
import mongoose from '../config/mongodb.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import {
    Appointment,
    AppointmentRule,
    AuditLog,
    Department,
    Doctor,
    MedicalRecord,
    Notification,
    Prescription,
    QueueEntry,
    Slot,
    SystemSetting,
    User,
} from '../models/index.js';
import { normalizeRole, serialize, serializeMany } from '../utils/mongo.js';
import { normalizeStatusValue } from '../utils/api.js';

const router = express.Router();

const POPULATE = {
    doctors: [
        { path: 'department_id', select: 'name description icon color capacity floor_number' },
        { path: 'user_id', select: 'email name phone role avatar_url' },
    ],
    appointments: [
        { path: 'patient_id', select: 'email phone name role date_of_birth gender blood_group allergies medical_history' },
        { path: 'doctor_id', select: 'name specialty phone consultation_fee' },
        { path: 'department_id', select: 'name description icon color' },
        { path: 'slot_id' },
    ],
    prescriptions: [
        { path: 'appointment_id' },
        { path: 'doctor_id', select: 'name specialty' },
        { path: 'patient_id', select: 'email phone name role blood_group allergies' },
    ],
    queue: [{ path: 'appointment_id' }],
};

const MODEL_COLLECTIONS = {
    appointments: { model: Appointment },
    appointment_rules: { model: AppointmentRule },
    appointment_slots: { model: Slot },
    audit_logs: { model: AuditLog },
    departments: { model: Department },
    doctors: { model: Doctor },
    medical_records: { model: MedicalRecord },
    notifications: { model: Notification },
    patients: { model: User, forcedFilter: { role: 'patient' } },
    prescriptions: { model: Prescription },
    queue: { model: QueueEntry },
    slots: { model: Slot },
    system_settings: { model: SystemSetting },
    users: { model: User },
};

const RAW_COLLECTIONS = new Set(['backup_jobs', 'encounters', 'user_roles']);

const PUBLIC_READ_COLLECTIONS = new Set(['departments', 'doctors', 'appointment_slots', 'slots']);
const STAFF_ROLES = new Set(['admin', 'management', 'receptionist']);
const ADMIN_WRITE_COLLECTIONS = new Set([
    'appointments',
    'appointment_rules',
    'appointment_slots',
    'audit_logs',
    'backup_jobs',
    'departments',
    'doctors',
    'encounters',
    'medical_records',
    'notifications',
    'patients',
    'prescriptions',
    'queue',
    'slots',
    'system_settings',
    'users',
]);
const DOCTOR_WRITE_COLLECTIONS = new Set(['appointments', 'doctors', 'encounters', 'medical_records', 'notifications', 'prescriptions', 'users']);
const PATIENT_WRITE_COLLECTIONS = new Set(['appointments', 'notifications', 'patients', 'users']);

const FIELD_MAP = {
    appointments: {
        appointment_date: 'date',
        appointment_time: 'time',
        no_show_score: 'no_show_risk_score',
    },
    appointment_slots: {
        slot_date: 'date',
        slot_time: 'start_time',
    },
    departments: {},
    doctors: {
        full_name: 'name',
        license_no: 'license_number',
        qualifications: 'qualification',
        daily_physical_quota: 'max_patients_per_day',
        schedule: 'available_hours',
    },
    notifications: {
        message: 'body',
        is_read: 'read',
    },
    patients: {
        full_name: 'name',
        dob: 'date_of_birth',
        sex: 'gender',
        status: 'is_active',
    },
    system_settings: {
        key: 'setting_key',
        value: 'setting_value',
    },
    users: {
        full_name: 'name',
        status: 'is_active',
    },
};

function parseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function mapField(collection, field) {
    if (!field) return field;
    if (field === 'id') return '_id';
    return FIELD_MAP[collection]?.[field] || field;
}

function coerceValue(field, value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (field === 'status') return normalizeStatusValue(value);
    if (field === '_id' || field.endsWith('_id')) {
        return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : value;
    }
    return value;
}

function buildRegex(value) {
    const raw = String(value || '');
    const escaped = raw
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replaceAll('%', '.*');
    return new RegExp(escaped, 'i');
}

function applyFilter(query, collection, filter) {
    const field = mapField(collection, filter.column);
    const value = coerceValue(field, filter.value);

    switch (filter.op) {
        case 'eq':
            query[field] = value;
            break;
        case 'neq':
            query[field] = { $ne: value };
            break;
        case 'gt':
            query[field] = { ...(query[field] || {}), $gt: value };
            break;
        case 'gte':
            query[field] = { ...(query[field] || {}), $gte: value };
            break;
        case 'lt':
            query[field] = { ...(query[field] || {}), $lt: value };
            break;
        case 'lte':
            query[field] = { ...(query[field] || {}), $lte: value };
            break;
        case 'in':
            query[field] = { $in: Array.isArray(filter.value) ? filter.value.map((v) => coerceValue(field, v)) : [] };
            break;
        case 'ilike':
            query[field] = buildRegex(filter.value);
            break;
        default:
            break;
    }
}

function applyOrFilter(query, collection, expression) {
    if (!expression) return;

    const clauses = String(expression)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const [column, op, ...rest] = part.split('.');
            const field = mapField(collection, column);
            const value = rest.join('.');

            if (op === 'ilike') return { [field]: buildRegex(value) };
            if (op === 'eq') return { [field]: coerceValue(field, value) };
            return null;
        })
        .filter(Boolean);

    if (clauses.length) query.$or = [...(query.$or || []), ...clauses];
}

function buildQuery(collection, req) {
    const config = MODEL_COLLECTIONS[collection] || {};
    const query = { ...(config.forcedFilter || {}) };

    for (const filter of parseJson(req.query.filters, [])) {
        applyFilter(query, collection, filter);
    }

    for (const orExpression of parseJson(req.query.orFilters, [])) {
        applyOrFilter(query, collection, orExpression);
    }

    return query;
}

function getRole(req) {
    return normalizeRole(req.userRole || req.user?.role);
}

function userId(req) {
    return req.user?.id || req.user?._id?.toString();
}

function userObjectId(req) {
    const id = userId(req);
    return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

function hasClientFilter(req) {
    return parseJson(req.query.filters, []).length > 0 || parseJson(req.query.orFilters, []).length > 0;
}

async function getCurrentDoctorId(req) {
    const uid = userObjectId(req);
    if (!uid) return null;
    const doctor = await Doctor.findOne({ user_id: uid }).select('_id').lean();
    return doctor?._id || null;
}

function requireSignedIn(req) {
    if (!req.user) {
        throw new AppError('Authentication required', 401);
    }
}

function assertReadAccess(collection, req) {
    if (PUBLIC_READ_COLLECTIONS.has(collection)) return;
    requireSignedIn(req);

    const role = getRole(req);
    if (STAFF_ROLES.has(role)) return;

    const allowedByRole = {
        doctor: new Set(['appointments', 'doctors', 'encounters', 'medical_records', 'notifications', 'patients', 'prescriptions', 'queue', 'users']),
        patient: new Set(['appointments', 'medical_records', 'notifications', 'patients', 'prescriptions', 'users']),
    };

    if (!allowedByRole[role]?.has(collection)) {
        throw new AppError('Forbidden', 403);
    }
}

function assertWriteAccess(collection, req) {
    requireSignedIn(req);

    const role = getRole(req);
    if (STAFF_ROLES.has(role) && ADMIN_WRITE_COLLECTIONS.has(collection)) return;
    if (role === 'doctor' && DOCTOR_WRITE_COLLECTIONS.has(collection)) return;
    if (role === 'patient' && PATIENT_WRITE_COLLECTIONS.has(collection)) return;

    throw new AppError('Forbidden', 403);
}

async function applyReadScope(collection, query, req) {
    const role = getRole(req);
    const uid = userObjectId(req);

    if (!req.user || STAFF_ROLES.has(role) || PUBLIC_READ_COLLECTIONS.has(collection)) return query;

    if (role === 'patient') {
        if (collection === 'appointments' || collection === 'prescriptions' || collection === 'medical_records') {
            query.patient_id = uid;
        }
        if (collection === 'notifications') query.user_id = uid;
        if (collection === 'patients' || collection === 'users') query._id = uid;
    }

    if (role === 'doctor') {
        if (collection === 'notifications') {
            query.user_id = uid;
            return query;
        }
        if (collection === 'users') {
            query._id = uid;
            return query;
        }

        const doctorId = await getCurrentDoctorId(req);
        if (collection === 'appointments' || collection === 'prescriptions' || collection === 'medical_records' || collection === 'encounters') {
            if (!doctorId) throw new AppError('Doctor profile not found', 403);
            query.doctor_id = doctorId;
        }
        if (collection === 'doctors' && doctorId) query._id = doctorId;
    }

    return query;
}

async function applyWriteScope(collection, query, updates, req, action) {
    const role = getRole(req);
    const uid = userObjectId(req);

    if ((action === 'update' || action === 'delete') && !hasClientFilter(req)) {
        throw new AppError('A filter is required for update/delete operations', 400);
    }

    if (STAFF_ROLES.has(role)) return { query, updates };

    if (role === 'patient') {
        if (collection === 'appointments') {
            if (action === 'insert') {
                updates.patient_id = uid;
            } else {
                query.patient_id = uid;
            }
        }
        if (collection === 'patients' || collection === 'users') {
            query._id = uid;
            delete updates.role;
            delete updates.is_active;
            delete updates.password_hash;
        }
        if (collection === 'notifications') {
            query.user_id = uid;
            if (action === 'insert') updates.user_id = uid;
        }
    }

    if (role === 'doctor') {
        if (collection === 'users') {
            query._id = uid;
            delete updates.role;
            delete updates.is_active;
            delete updates.password_hash;
            return { query, updates };
        }

        if (collection === 'notifications') {
            query.user_id = uid;
            if (action === 'insert') updates.user_id = uid;
            return { query, updates };
        }

        const doctorId = await getCurrentDoctorId(req);
        if (!doctorId && !(collection === 'doctors' && action === 'insert')) {
            throw new AppError('Doctor profile not found', 403);
        }

        if (collection === 'appointments' || collection === 'prescriptions' || collection === 'medical_records' || collection === 'encounters') {
            query.doctor_id = doctorId;
            if (action === 'insert') updates.doctor_id = doctorId;
        }
        if (collection === 'doctors') {
            if (doctorId) {
                query._id = doctorId;
            } else {
                updates.user_id = uid;
            }
        }
    }

    return { query, updates };
}

function buildSort(collection, req) {
    const orders = parseJson(req.query.orders, []);
    const sort = {};

    for (const order of orders) {
        sort[mapField(collection, order.column)] = order.ascending === false ? -1 : 1;
    }

    return sort;
}

function mapInput(collection, input = {}) {
    const mapped = {};
    for (const [key, value] of Object.entries(input)) {
        if (key === 'id') {
            mapped._id = value;
            continue;
        }
        mapped[mapField(collection, key)] = value;
    }

    if (collection === 'patients' || collection === 'users') {
        if ('gender' in mapped && mapped.gender) mapped.gender = String(mapped.gender).toLowerCase();
        if ('is_active' in mapped && typeof mapped.is_active === 'string') mapped.is_active = mapped.is_active === 'ACTIVE';
    }

    if (collection === 'patients') mapped.role = 'patient';
    if (collection === 'appointments' && mapped.status) mapped.status = normalizeStatusValue(mapped.status);
    if (collection === 'queue' && mapped.status) mapped.status = normalizeStatusValue(mapped.status);

    return mapped;
}

function titleCase(value) {
    if (!value) return value;
    return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
}

function normalizeDoctor(row) {
    const user = typeof row.user_id === 'object' ? row.user_id : null;
    const department = typeof row.department_id === 'object' ? row.department_id : null;
    return {
        ...row,
        user_id: user?.id || row.user_id,
        department_id: department?.id || row.department_id,
        full_name: row.name,
        name: row.name,
        license_no: row.license_number,
        email: row.email || user?.email,
        phone: row.phone || user?.phone,
        qualifications: row.qualification ? [row.qualification] : [],
        daily_physical_quota: row.max_patients_per_day || 0,
        daily_video_quota: Math.max(Math.floor((row.max_patients_per_day || 0) / 3), 0),
        schedule: row.available_hours,
        department: department
            ? {
                  id: department.id,
                  name: department.name,
                  color: department.color,
              }
            : null,
    };
}

function normalizePatient(row) {
    return {
        ...row,
        user_id: row.id,
        indus_id: row.indus_id || `IND-${String(row.id || '').slice(-6).toUpperCase()}`,
        full_name: row.name || row.email,
        dob: row.date_of_birth,
        sex: titleCase(row.gender),
        status: row.is_active ? 'ACTIVE' : 'INACTIVE',
    };
}

function normalizeAppointment(row) {
    const patient = typeof row.patient_id === 'object' ? row.patient_id : null;
    const doctor = typeof row.doctor_id === 'object' ? row.doctor_id : null;

    return {
        ...row,
        patient_id: patient?.id || row.patient_id,
        doctor_id: doctor?.id || row.doctor_id,
        department_id:
            typeof row.department_id === 'object' ? row.department_id.id : row.department_id,
        slot_id: typeof row.slot_id === 'object' ? row.slot_id.id : row.slot_id,
        appointment_date: row.date,
        appointment_time: row.time,
        no_show_score: row.no_show_risk_score,
        patient: patient
            ? {
                  id: patient.id,
                  patient_id: patient.indus_id || `IND-${String(patient.id || '').slice(-6).toUpperCase()}`,
                  name: patient.name || patient.email,
                  full_name: patient.name || patient.email,
                  phone: patient.phone,
                  email: patient.email,
                  dob: patient.date_of_birth,
                  sex: titleCase(patient.gender),
                  blood_group: patient.blood_group,
                  allergies: patient.allergies,
                  medical_history: patient.medical_history,
              }
            : null,
        doctor: doctor
            ? {
                  id: doctor.id,
                  name: doctor.name,
                  full_name: doctor.name,
                  specialty: doctor.specialty,
                  phone: doctor.phone,
              }
            : null,
    };
}

function normalizeSlot(row) {
    return {
        ...row,
        slot_date: row.date,
        slot_time: row.start_time,
    };
}

function normalizeNotification(row) {
    return {
        ...row,
        message: row.body,
        type: row.data?.type || 'info',
        is_read: Boolean(row.read),
    };
}

function normalizeSetting(row) {
    return {
        ...row,
        key: row.setting_key,
        value: row.setting_value,
    };
}

function normalizeForClient(collection, row) {
    const value = serialize(row);
    switch (collection) {
        case 'appointments':
            return normalizeAppointment(value);
        case 'appointment_slots':
        case 'slots':
            return normalizeSlot(value);
        case 'doctors':
            return normalizeDoctor(value);
        case 'notifications':
            return normalizeNotification(value);
        case 'patients':
        case 'users':
            return normalizePatient(value);
        case 'system_settings':
            return normalizeSetting(value);
        default:
            return value;
    }
}

async function executeModelRead(collection, req) {
    const config = MODEL_COLLECTIONS[collection];
    assertReadAccess(collection, req);

    const query = await applyReadScope(collection, buildQuery(collection, req), req);
    const sort = buildSort(collection, req);
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    let cursor = config.model.find(query);
    if (POPULATE[collection]) cursor = cursor.populate(POPULATE[collection]);
    if (Object.keys(sort).length) cursor = cursor.sort(sort);

    const docs = await cursor.skip(offset).limit(limit);
    return docs.map((doc) => normalizeForClient(collection, doc));
}

async function executeRawRead(collection, req) {
    assertReadAccess(collection, req);

    const query = await applyReadScope(collection, buildQuery(collection, req), req);
    const sort = buildSort(collection, req);
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const docs = await mongoose.connection.db
        .collection(collection)
        .find(query)
        .sort(sort)
        .skip(offset)
        .limit(limit)
        .toArray();

    return serializeMany(docs);
}

router.get(
    '/:collection',
    optionalAuth,
    asyncHandler(async (req, res) => {
        const collection = req.params.collection;

        const rows = MODEL_COLLECTIONS[collection]
            ? await executeModelRead(collection, req)
            : RAW_COLLECTIONS.has(collection)
              ? await executeRawRead(collection, req)
              : [];

        res.status(200).json({ data: rows });
    }),
);

router.post(
    '/rpc/:name',
    authMiddleware,
    asyncHandler(async (_req, res) => {
        res.status(200).json({ data: null });
    }),
);

router.post(
    '/:collection',
    authMiddleware,
    asyncHandler(async (req, res) => {
        const collection = req.params.collection;
        const payload = Array.isArray(req.body.data) ? req.body.data : [req.body.data || req.body];
        assertWriteAccess(collection, req);

        if (MODEL_COLLECTIONS[collection]) {
            const model = MODEL_COLLECTIONS[collection].model;
            const mappedPayload = [];
            for (const item of payload) {
                const mapped = mapInput(collection, item);
                const scoped = await applyWriteScope(collection, {}, mapped, req, 'insert');
                mappedPayload.push(scoped.updates);
            }

            const created = await model.create(mappedPayload);
            const rows = (Array.isArray(created) ? created : [created]).map((doc) =>
                normalizeForClient(collection, doc),
            );

            return res.status(201).json({ data: Array.isArray(req.body.data) ? rows : rows[0] });
        }

        if (RAW_COLLECTIONS.has(collection)) {
            const docs = [];
            for (const item of payload) {
                const scoped = await applyWriteScope(collection, {}, { ...item }, req, 'insert');
                docs.push({ ...scoped.updates, created_at: new Date(), updated_at: new Date() });
            }
            const result = await mongoose.connection.db.collection(collection).insertMany(docs);
            const rows = docs.map((doc, index) => ({
                ...serialize(doc),
                id: result.insertedIds[index].toString(),
                _id: result.insertedIds[index].toString(),
            }));
            return res.status(201).json({ data: Array.isArray(req.body.data) ? rows : rows[0] });
        }

        return res.status(404).json({ error: 'Unknown collection' });
    }),
);

router.patch(
    '/:collection',
    authMiddleware,
    asyncHandler(async (req, res) => {
        const collection = req.params.collection;
        assertWriteAccess(collection, req);

        const query = buildQuery(collection, req);
        const updates = mapInput(collection, req.body.data || req.body);

        delete updates._id;
        delete updates.created_at;
        updates.updated_at = new Date();

        const scoped = await applyWriteScope(collection, query, updates, req, 'update');

        if (MODEL_COLLECTIONS[collection]) {
            const model = MODEL_COLLECTIONS[collection].model;
            await model.updateMany(scoped.query, { $set: scoped.updates }, { runValidators: true });
            const rows = await executeModelRead(collection, req);
            return res.status(200).json({ data: rows });
        }

        if (RAW_COLLECTIONS.has(collection)) {
            await mongoose.connection.db.collection(collection).updateMany(scoped.query, { $set: scoped.updates });
            const rows = await executeRawRead(collection, req);
            return res.status(200).json({ data: rows });
        }

        return res.status(404).json({ error: 'Unknown collection' });
    }),
);

router.put(
    '/:collection',
    authMiddleware,
    asyncHandler(async (req, res) => {
        const collection = req.params.collection;
        assertWriteAccess(collection, req);

        const item = mapInput(collection, req.body.data || req.body);
        const conflictKey = mapField(collection, req.body.onConflict || 'id');
        const filter =
            conflictKey === '_id' && item._id
                ? { _id: coerceValue('_id', item._id) }
                : { [conflictKey]: item[conflictKey] };
        const scoped = await applyWriteScope(collection, filter, item, req, 'upsert');

        if (MODEL_COLLECTIONS[collection]) {
            const model = MODEL_COLLECTIONS[collection].model;
            const doc = await model.findOneAndUpdate(
                scoped.query,
                { $set: scoped.updates },
                { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
            );
            return res.status(200).json({ data: normalizeForClient(collection, doc) });
        }

        if (RAW_COLLECTIONS.has(collection)) {
            await mongoose.connection.db
                .collection(collection)
                .updateOne(scoped.query, { $set: { ...scoped.updates, updated_at: new Date() } }, { upsert: true });
            const doc = await mongoose.connection.db.collection(collection).findOne(scoped.query);
            return res.status(200).json({ data: serialize(doc) });
        }

        return res.status(404).json({ error: 'Unknown collection' });
    }),
);

router.delete(
    '/:collection',
    authMiddleware,
    asyncHandler(async (req, res) => {
        const collection = req.params.collection;
        assertWriteAccess(collection, req);

        const query = buildQuery(collection, req);
        const scoped = await applyWriteScope(collection, query, {}, req, 'delete');

        if (MODEL_COLLECTIONS[collection]) {
            await MODEL_COLLECTIONS[collection].model.deleteMany(scoped.query);
            return res.status(200).json({ data: [] });
        }

        if (RAW_COLLECTIONS.has(collection)) {
            await mongoose.connection.db.collection(collection).deleteMany(scoped.query);
            return res.status(200).json({ data: [] });
        }

        return res.status(404).json({ error: 'Unknown collection' });
    }),
);

export default router;
