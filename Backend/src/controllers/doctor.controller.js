import { AuditLog, Doctor, Slot, SystemSetting, User } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize } from '../utils/mongo.js';
import {
    buildListFilter,
    buildProjection,
    buildSort,
    getListOptions,
    pagedFind,
    parseJson,
} from '../utils/api.js';
import { cacheKey, getOrSetCache, invalidateCache } from '../services/cache.service.js';
import { emitQueueEvent } from '../services/realtime.service.js';

const doctorPopulate = [
    { path: 'department_id', select: 'name description capacity floor_number contact_email contact_phone' },
    { path: 'user_id', select: 'email name phone role avatar_url' },
];

const FIELD_MAP = {
    full_name: 'name',
    license_no: 'license_number',
    qualifications: 'qualification',
    daily_physical_quota: 'max_patients_per_day',
    schedule: 'available_hours',
};

const writableFields = new Set([
    'user_id',
    'name',
    'specialty',
    'department_id',
    'qualification',
    'experience_years',
    'license_number',
    'consultation_fee',
    'available_days',
    'available_hours',
    'max_patients_per_day',
    'average_consultation_time',
    'daily_video_quota',
    'rating',
    'total_reviews',
    'bio',
    'languages',
    'is_available',
    'is_active',
]);

function getEmailFilter(query = {}) {
    const direct = query.email ? String(query.email).trim().toLowerCase() : '';
    if (direct) return direct;

    for (const item of parseJson(query.filters, [])) {
        if (!item || item.column !== 'email') continue;
        if (!['eq', 'ilike'].includes(item.op)) continue;
        const value = String(item.value || '').replaceAll('%', '').trim().toLowerCase();
        if (value) return value;
    }

    return '';
}

function normalizeDoctorInput(input = {}) {
    const mapped = {
        ...input,
        name: input.name ?? input.full_name,
        license_number: input.license_number ?? input.license_no,
        qualification: input.qualification ?? (
            Array.isArray(input.qualifications) ? input.qualifications.join(', ') : input.qualifications
        ),
        max_patients_per_day: input.max_patients_per_day ?? input.daily_physical_quota,
        available_hours: input.available_hours ?? input.schedule,
    };

    if (!mapped.name && mapped.email) {
        mapped.name = String(mapped.email).split('@')[0];
    }

    const output = {};
    for (const [key, value] of Object.entries(mapped)) {
        if (!writableFields.has(key) || value === undefined) continue;
        if ((key === 'user_id' || key === 'department_id') && value) {
            output[key] = requireObjectId(value, key);
        } else {
            output[key] = value;
        }
    }

    return output;
}

async function maybeCreateDoctorUser(input = {}) {
    const email = input.email ? String(input.email).trim().toLowerCase() : null;
    if (!email) return input.user_id || input.userId || null;

    const existing = await User.findOne({ email }).select('_id').lean();
    if (existing) return existing._id;

    const user = await User.create({
        email,
        phone: input.phone || null,
        name: input.name || input.full_name || email.split('@')[0],
        role: 'doctor',
        auth_provider: 'admin-created',
        is_active: true,
    });

    return user._id;
}

function serializeDoctor(row) {
    const value = serialize(row);
    const user = value && typeof value.user_id === 'object' ? value.user_id : null;
    const department = value && typeof value.department_id === 'object' ? value.department_id : null;

    return {
        ...value,
        user_id: user?.id || value.user_id,
        department_id: department?.id || value.department_id,
        full_name: value.name,
        name: value.name,
        license_no: value.license_number,
        email: value.email || user?.email,
        phone: value.phone || user?.phone,
        qualifications: value.qualification ? [value.qualification] : [],
        daily_physical_quota: value.max_patients_per_day || 0,
        daily_video_quota:
            value.daily_video_quota ?? Math.max(Math.floor((value.max_patients_per_day || 0) / 3), 0),
        schedule: value.available_hours,
        department: department
            ? {
                  id: department.id,
                  name: department.name,
                  color: department.color,
              }
            : null,
    };
}

function serializeDoctors(rows = []) {
    return rows.map(serializeDoctor);
}

function serializeSlot(row) {
    const value = serialize(row);
    return {
        ...value,
        slot_date: value.date,
        slot_time: value.start_time,
    };
}

function withRequiredProjectionFields(projection) {
    if (!projection) return projection;
    const fields = new Set(projection.split(/\s+/).filter(Boolean));
    fields.add('user_id');
    fields.add('department_id');
    fields.add('name');
    fields.add('license_number');
    fields.add('max_patients_per_day');
    fields.add('daily_video_quota');
    fields.add('available_hours');
    return Array.from(fields).join(' ');
}

export const getAllDoctors = async (req, res) => {
    const { specialty, departmentId, available = 'false', search } = req.query;
    const list = getListOptions(req.query);

    const filter = buildListFilter(req, { fieldMap: FIELD_MAP });
    const email = getEmailFilter(req.query);
    if (email) {
        const doctorUser = await User.findOne({ email, role: 'doctor', is_active: true }).select('_id').lean();
        filter.user_id = doctorUser?._id || null;
    }

    if (filter.is_active === undefined) filter.is_active = true;

    if (specialty) {
        filter.specialty = specialty;
    }

    if (departmentId) {
        filter.department_id = requireObjectId(departmentId, 'departmentId');
    }

    if (available === 'true') {
        filter.is_available = true;
    }

    if (search) {
        filter.$text = { $search: String(search).trim() };
    }

    const sort = search
        ? { score: { $meta: 'textScore' } }
        : buildSort(req.query, {
              fieldMap: FIELD_MAP,
              allowed: ['name', 'specialty', 'created_at', 'rating', 'experience_years'],
              fallback: { name: 1 },
          });
    const projection = withRequiredProjectionFields(buildProjection(req.query, [
        '_id',
        'id',
        'user_id',
        'name',
        'specialty',
        'department_id',
        'qualification',
        'experience_years',
        'license_number',
        'consultation_fee',
        'available_days',
        'available_hours',
        'max_patients_per_day',
        'daily_video_quota',
        'average_consultation_time',
        'rating',
        'bio',
        'is_available',
        'is_active',
        'created_at',
        'updated_at',
    ], FIELD_MAP));

    const key = cacheKey('doctors:list', req.query);
    const result = await getOrSetCache(key, 120, async () => {
        const { items, pagination } = await pagedFind(Doctor, filter, {
            ...list,
            sort,
            projection,
            populate: doctorPopulate,
            maxTimeMS: 5000,
        });
        return { doctors: serializeDoctors(items), pagination };
    });

    res.status(200).json({ ...result, data: result.doctors });
};

export const createDoctor = async (req, res) => {
    const input = { ...req.body };
    const userId = await maybeCreateDoctorUser(input);
    const payload = normalizeDoctorInput({ ...input, user_id: userId || input.user_id || input.userId });

    if (!payload.name) throw new AppError('Doctor name is required', 400);
    if (!payload.specialty) throw new AppError('Doctor specialty is required', 400);
    if (!payload.department_id) throw new AppError('Doctor department_id is required', 400);
    if (!payload.license_number) payload.license_number = `PMC-${Date.now()}`;

    const doctor = await Doctor.create(payload);

    await AuditLog.create({
        user_id: req.user?.id,
        action: 'doctor.created',
        collection_name: 'doctors',
        record_id: doctor._id,
        new_data: serialize(doctor),
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['doctors:*', 'doctor-schedule:*', 'dashboard:*']);

    const hydrated = await Doctor.findById(doctor._id).populate(doctorPopulate).lean({ virtuals: true });
    const data = serializeDoctor(hydrated);
    res.status(201).json({ doctor: data, data });
};

export const updateDoctor = async (req, res) => {
    const id = requireObjectId(req.params.id, 'doctorId');
    const updates = normalizeDoctorInput(req.body);
    delete updates.id;
    delete updates._id;
    delete updates.created_at;
    delete updates.updated_at;

    const doctor = await Doctor.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
    }).populate(doctorPopulate);

    if (!doctor) throw new AppError('Doctor not found', 404);

    await AuditLog.create({
        user_id: req.user?.id,
        action: 'doctor.updated',
        collection_name: 'doctors',
        record_id: doctor._id,
        new_data: updates,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['doctors:*', `doctor-schedule:${doctor._id}:*`, 'dashboard:*']);

    // Nudge open admin/management dashboards to refetch doctor capacity/roster.
    emitQueueEvent('queue.updated', { doctor_id: doctor._id.toString(), reason: 'doctor.updated' });

    const data = serializeDoctor(doctor);
    res.status(200).json({ doctor: data, data });
};

export const getDoctorById = async (req, res) => {
    const doctor = await Doctor.findById(requireObjectId(req.params.id))
        .populate(doctorPopulate)
        .maxTimeMS(5000)
        .lean({ virtuals: true });

    if (!doctor || !doctor.is_active) {
        throw new AppError('Doctor not found', 404);
    }

    const data = serializeDoctor(doctor);
    res.status(200).json({ doctor: data, data });
};

export const getDoctorsByDepartment = async (req, res) => {
    const departmentId = requireObjectId(req.params.departmentId, 'departmentId');

    const doctors = await Doctor.find({ department_id: departmentId, is_active: true })
        .populate(doctorPopulate)
        .sort({ name: 1 })
        .maxTimeMS(5000)
        .lean({ virtuals: true });

    const data = serializeDoctors(doctors);
    res.status(200).json({ doctors: data, data });
};

export const getDoctorSlots = async (req, res) => {
    const doctorId = requireObjectId(req.params.id, 'doctorId');
    const { date, startDate, endDate } = req.query;

    const setting = await SystemSetting.findOne({ setting_key: 'slots_blocked' }).select('setting_value').lean();
    if (setting?.setting_value?.blocked) {
        return res.status(200).json({ slots: [], data: [] });
    }

    const filter = {
        doctor_id: doctorId,
        is_available: true,
    };

    if (date) {
        filter.date = date;
    } else if (startDate && endDate) {
        filter.date = { $gte: startDate, $lte: endDate };
    } else {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        filter.date = {
            $gte: today.toISOString().split('T')[0],
            $lte: nextWeek.toISOString().split('T')[0],
        };
    }

    const key = cacheKey(`doctor-schedule:${doctorId}`, req.query);
    const slots = await getOrSetCache(key, 30, async () => (
        Slot.find(filter)
            .sort({ date: 1, start_time: 1 })
            .maxTimeMS(5000)
            .lean({ virtuals: true })
    ));

    const data = slots.map(serializeSlot);
    res.status(200).json({ slots: data, data });
};
