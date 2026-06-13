import { AuditLog, Slot, SystemSetting } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize } from '../utils/mongo.js';
import {
    buildListFilter,
    buildProjection,
    buildSort,
    getListOptions,
    pagedFind,
} from '../utils/api.js';
import { cacheKey, getOrSetCache, invalidateCache } from '../services/cache.service.js';

const FIELD_MAP = {
    doctorId: 'doctor_id',
    slot_date: 'date',
    slot_time: 'start_time',
};

const SORT_FIELDS = ['date', 'start_time', 'doctor_id', 'is_available', 'created_at'];
const PROJECTION_FIELDS = [
    '_id',
    'id',
    'doctor_id',
    'date',
    'start_time',
    'end_time',
    'is_available',
    'max_patients',
    'current_patients',
    'created_at',
    'updated_at',
];

function serializeSlot(row) {
    const value = serialize(row);
    return {
        ...value,
        slot_date: value.date,
        slot_time: value.start_time,
    };
}

function serializeSlots(rows = []) {
    return rows.map(serializeSlot);
}

export const listSlots = async (req, res) => {
    const list = getListOptions(req.query);
    const filter = buildListFilter(req, { fieldMap: FIELD_MAP });
    const sort = buildSort(req.query, {
        fieldMap: FIELD_MAP,
        allowed: SORT_FIELDS,
        fallback: { date: 1, start_time: 1 },
    });
    const projection = buildProjection(req.query, PROJECTION_FIELDS, FIELD_MAP);
    if (req.query.available !== undefined) filter.is_available = req.query.available === 'true';

    if (filter.is_available === true) {
        const setting = await SystemSetting.findOne({ setting_key: 'slots_blocked' }).select('setting_value').lean();
        if (setting?.setting_value?.blocked) {
            return res.status(200).json({ slots: [], data: [], pagination: { page: 1, limit: list.limit, total: 0, pages: 0 } });
        }
    }

    const key = cacheKey('slots:list', req.query);
    const result = await getOrSetCache(key, 30, async () => {
        const { items, pagination } = await pagedFind(Slot, filter, {
            ...list,
            sort,
            projection,
            maxTimeMS: 5000,
        });
        return { slots: serializeSlots(items), pagination };
    });

    res.status(200).json({ ...result, data: result.slots });
};

export const getSlotById = async (req, res) => {
    const slot = await Slot.findById(requireObjectId(req.params.id, 'slotId'))
        .maxTimeMS(5000)
        .lean({ virtuals: true });
    if (!slot) throw new AppError('Slot not found', 404);
    const data = serializeSlot(slot);
    res.status(200).json({ slot: data, data });
};

export const createSlot = async (req, res) => {
    const slot = await Slot.create({
        doctor_id: requireObjectId(req.body.doctor_id || req.body.doctorId, 'doctorId'),
        date: req.body.date || req.body.slot_date,
        start_time: req.body.start_time || req.body.slot_time,
        end_time: req.body.end_time || req.body.endTime,
        is_available: req.body.is_available ?? true,
        max_patients: req.body.max_patients || 1,
        current_patients: req.body.current_patients || 0,
    });

    await AuditLog.create({
        user_id: req.user?.id,
        action: 'slot.created',
        collection_name: 'slots',
        record_id: slot._id,
        new_data: serialize(slot),
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['slots:*', `doctor-schedule:${slot.doctor_id}:*`, 'dashboard:*']);

    const data = serializeSlot(slot);
    res.status(201).json({ slot: data, data });
};

export const updateSlot = async (req, res) => {
    const updates = { ...req.body };
    delete updates.id;
    delete updates._id;
    delete updates.created_at;
    delete updates.updated_at;

    const slot = await Slot.findByIdAndUpdate(
        requireObjectId(req.params.id, 'slotId'),
        updates,
        { new: true, runValidators: true },
    );

    if (!slot) throw new AppError('Slot not found', 404);

    await AuditLog.create({
        user_id: req.user?.id,
        action: 'slot.updated',
        collection_name: 'slots',
        record_id: slot._id,
        new_data: updates,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['slots:*', `doctor-schedule:${slot.doctor_id}:*`, 'dashboard:*']);

    const data = serializeSlot(slot);
    res.status(200).json({ slot: data, data });
};
