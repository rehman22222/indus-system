import { AuditLog, User } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import {
    requireObjectId,
    serialize,
} from '../utils/mongo.js';
import { buildListFilter, buildProjection, buildSort, getListOptions, pagedFind } from '../utils/api.js';
import { invalidateCache } from '../services/cache.service.js';

const FIELD_MAP = {
    full_name: 'name',
    dob: 'date_of_birth',
    sex: 'gender',
    status: 'is_active',
};

function normalizeGender(value) {
    if (!value) return value;
    const normalized = String(value).trim().toLowerCase();
    if (normalized.startsWith('m')) return 'male';
    if (normalized.startsWith('f')) return 'female';
    if (normalized.startsWith('o')) return 'other';
    return normalized;
}

function normalizePatientInput(input = {}) {
    const mapped = {
        ...input,
        name: input.name ?? input.full_name,
        date_of_birth: input.date_of_birth ?? input.dob,
        gender: input.gender ?? input.sex,
        blood_group: input.blood_group ?? input.bloodGroup,
    };

    const output = {};
    for (const [key, value] of Object.entries(mapped)) {
        if (value === undefined) continue;
        if (['id', '_id', 'created_at', 'updated_at', 'password_hash', 'role', 'user_id', 'indus_id'].includes(key)) {
            continue;
        }
        output[key] = key === 'gender' ? normalizeGender(value) : value;
    }

    return output;
}

function titleCase(value) {
    if (!value) return value;
    return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
}

function serializePatient(row) {
    const value = serialize(row);
    return {
        ...value,
        user_id: value.id,
        indus_id: value.indus_id || `IND-${String(value.id || '').slice(-6).toUpperCase()}`,
        full_name: value.name || value.email,
        dob: value.date_of_birth,
        sex: titleCase(value.gender),
        status: value.is_active ? 'ACTIVE' : 'INACTIVE',
    };
}

function serializePatients(rows = []) {
    return rows.map(serializePatient);
}

export const getAllPatients = async (req, res) => {
    const { search } = req.query;
    const list = getListOptions(req.query);

    const filter = buildListFilter(req, { fieldMap: FIELD_MAP });
    filter.role = 'patient';

    // A patient may only read their own record. The web portal queries this
    // route as `patients.user_id == <their id>`; in this model the patient IS
    // the User, so force the scope to self and drop client filters that don't
    // map to the User document (e.g. user_id, search).
    if (req.userRole === 'patient') {
        delete filter.user_id;
        delete filter.$text;
        filter._id = requireObjectId(req.user.id, 'patientId');
    } else if (search) {
        filter.$text = { $search: String(search).trim() };
    }

    const sort = search
        ? { score: { $meta: 'textScore' } }
        : buildSort(req.query, {
              fieldMap: FIELD_MAP,
              allowed: ['created_at', 'updated_at', 'name', 'email', 'phone'],
              fallback: { created_at: -1 },
          });
    const projection = buildProjection(req.query, [
        '_id',
        'id',
        'email',
        'phone',
        'name',
        'role',
        'date_of_birth',
        'gender',
        'address',
        'blood_group',
        'allergies',
        'medical_history',
        'is_active',
        'created_at',
        'updated_at',
    ], FIELD_MAP);

    const { items, pagination } = await pagedFind(User, filter, {
        ...list,
        sort,
        projection,
        maxTimeMS: 5000,
    });

    const patients = serializePatients(items);
    res.status(200).json({ patients, data: patients, pagination });
};

export const getPatientById = async (req, res) => {
    const patientId = requireObjectId(req.params.id, 'patientId');

    if (req.userRole === 'patient' && req.user.id !== patientId.toString()) {
        throw new AppError('Unauthorized to view this patient', 403);
    }

    const patient = await User.findOne({ _id: patientId, role: 'patient' })
        .maxTimeMS(5000)
        .lean({ virtuals: true });
    if (!patient) {
        throw new AppError('Patient not found', 404);
    }

    const data = serializePatient(patient);
    res.status(200).json({ patient: data, data });
};

export const createPatient = async (req, res) => {
    const payload = normalizePatientInput(req.body);
    if (!payload.name && !payload.email && !payload.phone) {
        throw new AppError('Patient name, email, or phone is required', 400);
    }

    const patient = await User.create({
        ...payload,
        role: 'patient',
        auth_provider: 'admin-created',
        is_active: payload.is_active ?? true,
    });

    await AuditLog.create({
        user_id: req.user?.id,
        action: 'patient.created',
        collection_name: 'users',
        record_id: patient._id,
        new_data: serialize(patient),
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['patients:*', 'dashboard:*']);

    const data = serializePatient(patient);
    res.status(201).json({ patient: data, data });
};

export const updatePatient = async (req, res) => {
    const patientId = requireObjectId(req.params.id, 'patientId');

    if (req.userRole === 'patient' && req.user.id !== patientId.toString()) {
        throw new AppError('Unauthorized to update this patient', 403);
    }

    const updates = normalizePatientInput(req.body);

    const patient = await User.findOneAndUpdate(
        { _id: patientId, role: 'patient' },
        updates,
        { new: true, runValidators: true },
    );

    if (!patient) {
        throw new AppError('Patient not found', 404);
    }

    await AuditLog.create({
        user_id: req.user?.id,
        action: 'patient.updated',
        collection_name: 'users',
        record_id: patient._id,
        new_data: updates,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['patients:*', 'dashboard:*']);

    res.status(200).json({
        message: 'Patient updated successfully',
        patient: serializePatient(patient),
        data: serializePatient(patient),
    });
};
