import {
    Appointment,
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
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize, serializeMany } from '../utils/mongo.js';
import { buildProjection, buildSort, getListOptions, pagedFind, parseJson } from '../utils/api.js';
import { cacheKey, getOrSetCache, invalidateCache } from '../services/cache.service.js';
import { hashPassword } from '../services/password.service.js';

function serializeSetting(row) {
    const value = serialize(row);
    return {
        ...value,
        key: value.setting_key,
        value: value.setting_value,
    };
}

function serializeSettings(rows = []) {
    return rows.map(serializeSetting);
}

export const getAdminDashboard = async (req, res) => {
    const key = cacheKey('dashboard:admin', req.query);
    const data = await getOrSetCache(key, 30, async () => {
        const [
            appointments,
            patients,
            doctors,
            waitingQueue,
            unreadNotifications,
            availableSlots,
        ] = await Promise.all([
            Appointment.countDocuments({}).maxTimeMS(5000),
            User.countDocuments({ role: 'patient' }).maxTimeMS(5000),
            Doctor.countDocuments({ is_active: true }).maxTimeMS(5000),
            QueueEntry.countDocuments({ status: { $in: ['waiting', 'called', 'in_consultation'] } }).maxTimeMS(5000),
            Notification.countDocuments({ read: false }).maxTimeMS(5000),
            Slot.countDocuments({ is_available: true }).maxTimeMS(5000),
        ]);

        return {
            appointments,
            patients,
            doctors,
            waitingQueue,
            unreadNotifications,
            availableSlots,
        };
    });

    res.status(200).json({ dashboard: data, data });
};

export const listAuditLogs = async (req, res) => {
    const list = getListOptions(req.query);
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.collection_name) filter.collection_name = req.query.collection_name;

    const sort = buildSort(req.query, {
        allowed: ['created_at', 'action', 'collection_name'],
        fallback: { created_at: -1 },
    });
    const projection = buildProjection(req.query, [
        '_id',
        'id',
        'user_id',
        'action',
        'collection_name',
        'record_id',
        'old_data',
        'new_data',
        'ip_address',
        'user_agent',
        'created_at',
        'updated_at',
    ]);

    const { items, pagination } = await pagedFind(AuditLog, filter, {
        ...list,
        sort,
        projection,
        maxTimeMS: 5000,
    });

    const auditLogs = serializeMany(items);
    res.status(200).json({ auditLogs, data: auditLogs, pagination });
};

export const createAuditLog = async (req, res) => {
    const auditLog = await AuditLog.create({
        user_id: req.body.user_id || req.user?.id,
        action: req.body.action,
        collection_name: req.body.collection_name,
        record_id: req.body.record_id && /^[a-f\d]{24}$/i.test(String(req.body.record_id))
            ? requireObjectId(req.body.record_id, 'recordId')
            : undefined,
        old_data: req.body.old_data,
        new_data: req.body.new_data,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });

    const data = serialize(auditLog);
    res.status(201).json({ auditLog: data, data });
};

export const createSystemBackup = async (req, res) => {
    const generatedAt = new Date();
    const [users, departments, doctors, slots, appointments, prescriptions, medicalRecords, queue, notifications, settings] = await Promise.all([
        User.find({}).select('-password_hash -fcm_token -push_tokens').lean(),
        Department.find({}).lean(),
        Doctor.find({}).lean(),
        Slot.find({}).lean(),
        Appointment.find({}).lean(),
        Prescription.find({}).lean(),
        MedicalRecord.find({}).lean(),
        QueueEntry.find({}).lean(),
        Notification.find({}).lean(),
        SystemSetting.find({}).lean(),
    ]);

    const backup = {
        schema_version: 1,
        generated_at: generatedAt.toISOString(),
        database: 'doctorappointment',
        collections: {
            users: serializeMany(users),
            departments: serializeMany(departments),
            doctors: serializeMany(doctors),
            slots: serializeMany(slots),
            appointments: serializeMany(appointments),
            prescriptions: serializeMany(prescriptions),
            medical_records: serializeMany(medicalRecords),
            queue: serializeMany(queue),
            notifications: serializeMany(notifications),
            system_settings: serializeMany(settings),
        },
    };

    await SystemSetting.findOneAndUpdate(
        { setting_key: 'last_backup' },
        {
            setting_key: 'last_backup',
            setting_value: generatedAt.toISOString(),
            description: 'Last successful logical database backup',
            updated_by: req.user?.id,
        },
        { upsert: true, new: true, runValidators: true },
    );
    await AuditLog.create({
        user_id: req.user?.id,
        action: 'backup.created',
        collection_name: 'system',
        new_data: {
            generated_at: generatedAt.toISOString(),
            record_counts: Object.fromEntries(
                Object.entries(backup.collections).map(([name, rows]) => [name, rows.length]),
            ),
        },
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['dashboard:*', 'admin:*']);

    res.status(200).json({
        message: 'Logical backup generated successfully',
        filename: `indus_backup_${generatedAt.toISOString().replace(/[:.]/g, '-')}.json`,
        backup,
        data: backup,
    });
};

function settingKeyFromQuery(query = {}) {
    const direct = query.key || query.setting_key;
    if (direct) return String(direct);
    for (const item of parseJson(query.filters, [])) {
        if (item && (item.column === 'key' || item.column === 'setting_key') && item.op === 'eq' && item.value) {
            return String(item.value);
        }
    }
    return '';
}

export const listSystemSettings = async (req, res) => {
    const list = getListOptions(req.query);
    const filter = {};
    if (req.query.public !== undefined) filter.is_public = req.query.public === 'true';

    const settingKey = settingKeyFromQuery(req.query);
    if (settingKey) filter.setting_key = settingKey;

    const { items, pagination } = await pagedFind(SystemSetting, filter, {
        ...list,
        sort: { setting_key: 1 },
        projection: '',
        maxTimeMS: 5000,
    });

    const settings = serializeSettings(items);
    res.status(200).json({ settings, data: settings, pagination });
};

export const upsertSystemSetting = async (req, res) => {
    const key = req.body.setting_key || req.body.key;
    if (!key) throw new AppError('setting_key is required', 400);

    const setting = await SystemSetting.findOneAndUpdate(
        { setting_key: key },
        {
            setting_key: key,
            setting_value: req.body.setting_value ?? req.body.value,
            description: req.body.description,
            is_public: req.body.is_public ?? false,
            updated_by: req.user?.id,
        },
        { new: true, runValidators: true, upsert: true },
    );

    await invalidateCache(['dashboard:*', 'admin:*']);
    const data = serializeSetting(setting);
    res.status(200).json({ setting: data, data });
};

export const updateSystemSetting = async (req, res) => {
    const setting = await SystemSetting.findByIdAndUpdate(
        requireObjectId(req.params.id, 'settingId'),
        { ...req.body, updated_by: req.user?.id },
        { new: true, runValidators: true },
    );

    if (!setting) throw new AppError('System setting not found', 404);
    await invalidateCache(['dashboard:*', 'admin:*']);
    const data = serializeSetting(setting);
    res.status(200).json({ setting: data, data });
};

const STAFF_ROLES = new Set(['admin', 'management', 'doctor', 'receptionist']);

export const createStaffAccount = async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const name = String(req.body.name || req.body.fullName || req.body.full_name || '').trim();
    const role = String(req.body.role || '').trim().toLowerCase();

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new AppError('Valid email is required', 400);
    if (password.length < 6) throw new AppError('Password must be at least 6 characters', 400);
    if (!name) throw new AppError('Full name is required', 400);
    if (!STAFF_ROLES.has(role)) throw new AppError('Invalid staff role', 400);

    const user = await User.findOneAndUpdate(
        { email },
        {
            email,
            name,
            phone: req.body.phone || undefined,
            role,
            password_hash: await hashPassword(password),
            auth_provider: 'password',
            is_active: true,
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    let doctor = null;
    if (role === 'doctor') {
        const departmentId = requireObjectId(req.body.departmentId || req.body.department_id, 'departmentId');
        doctor = await Doctor.findOneAndUpdate(
            { user_id: user._id },
            {
                user_id: user._id,
                name,
                specialty: String(req.body.specialty || 'General Medicine').trim(),
                department_id: departmentId,
                license_number: req.body.license_number || req.body.license_no || `PMC-${Date.now()}`,
                max_patients_per_day: Number(req.body.dailyPhysicalQuota ?? req.body.daily_physical_quota ?? 30),
                daily_video_quota: Number(req.body.dailyVideoQuota ?? req.body.daily_video_quota ?? 10),
                is_active: true,
                is_available: true,
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
    }

    await AuditLog.create({
        user_id: req.user?.id,
        action: 'staff_account.created',
        collection_name: 'users',
        record_id: user._id,
        new_data: { email, name, role, doctor_id: doctor?._id },
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['doctors:*', 'users:*', 'dashboard:*']);

    res.status(201).json({
        message: `${role} account created`,
        user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
        doctor: doctor ? serialize(doctor) : null,
        data: { userId: user._id.toString(), doctorId: doctor?._id?.toString?.() },
    });
};
