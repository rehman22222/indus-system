import {
    Appointment,
    AuditLog,
    Doctor,
    Notification,
    QueueEntry,
    Slot,
    SystemSetting,
    User,
} from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize, serializeMany } from '../utils/mongo.js';
import { buildProjection, buildSort, getListOptions, pagedFind } from '../utils/api.js';
import { cacheKey, getOrSetCache, invalidateCache } from '../services/cache.service.js';

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

export const listSystemSettings = async (req, res) => {
    const list = getListOptions(req.query);
    const filter = {};
    if (req.query.public !== undefined) filter.is_public = req.query.public === 'true';

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
