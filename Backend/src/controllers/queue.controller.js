import { Appointment, QueueEntry } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize } from '../utils/mongo.js';
import {
    QUEUE_STATUSES,
    buildSort,
    getListOptions,
    getPaginationMeta,
    normalizeStatus,
    normalizeStatusValue,
} from '../utils/api.js';
import { cacheKey, getOrSetCache, invalidateCache } from '../services/cache.service.js';
import { emitQueueEvent } from '../services/realtime.service.js';

const queuePopulate = {
    path: 'appointment_id',
    populate: [
        { path: 'patient_id', select: 'name email phone' },
        { path: 'doctor_id', select: 'name specialty' },
        { path: 'department_id', select: 'name' },
    ],
};

function queueEvent(status) {
    switch (status) {
        case 'called':
            return 'patient.called';
        case 'in_consultation':
            return 'consultation.started';
        case 'completed':
            return 'consultation.completed';
        case 'no_show':
            return 'appointment.cancelled';
        default:
            return 'queue.updated';
    }
}

function serializeQueueEntry(row) {
    const value = serialize(row);
    return {
        ...value,
        status: normalizeStatusValue(value.status),
        appointment_id: value.appointment_id && typeof value.appointment_id === 'object'
            ? {
                  ...value.appointment_id,
                  status: normalizeStatusValue(value.appointment_id.status),
                  appointment_date: value.appointment_id.date,
                  appointment_time: value.appointment_id.time,
              }
            : value.appointment_id,
    };
}

function serializeQueue(rows = []) {
    return rows.map(serializeQueueEntry);
}

export const getQueue = async (req, res) => {
    const list = getListOptions(req.query);
    const sort = buildSort(req.query, {
        allowed: ['position', 'status', 'created_at', 'updated_at'],
        fallback: { position: 1 },
    });

    // Short TTL: the queue is realtime, but a 10s cache absorbs dashboard
    // polling bursts. Writes (check-in, call, status change) invalidate
    // `queue:*`, so clients still see changes promptly.
    const key = cacheKey('queue:list', req.query);
    const result = await getOrSetCache(key, 10, async () => {
        const { departmentId, department_id, doctorId, doctor_id, date } = req.query;
        const filter = {};

        if (req.query.status) {
            const normalizedStatus = normalizeStatus(req.query.status, QUEUE_STATUSES);
            filter.status = normalizedStatus === 'in_consultation'
                ? { $in: ['in_consultation', 'in-progress', 'in_progress'] }
                : normalizedStatus === 'no_show'
                    ? { $in: ['no_show', 'no-show'] }
                    : normalizedStatus;
        }

        if (doctorId || doctor_id || departmentId || department_id || date) {
            const appointmentFilter = {};
            if (doctorId || doctor_id) appointmentFilter.doctor_id = requireObjectId(doctorId || doctor_id, 'doctorId');
            if (departmentId || department_id) appointmentFilter.department_id = requireObjectId(departmentId || department_id, 'departmentId');
            if (date) appointmentFilter.date = date;

            const appointmentIds = await Appointment.find(appointmentFilter)
                .select('_id')
                .maxTimeMS(5000)
                .lean();
            filter.appointment_id = { $in: appointmentIds.map((item) => item._id) };
        }

        const [queue, total] = await Promise.all([
            QueueEntry.find(filter)
                .populate(queuePopulate)
                .sort(sort)
                .skip(list.skip)
                .limit(list.limit)
                .maxTimeMS(5000)
                .lean({ virtuals: true }),
            QueueEntry.countDocuments(filter).maxTimeMS(5000),
        ]);

        return {
            queue: serializeQueue(queue),
            pagination: getPaginationMeta({ page: list.page, limit: list.limit, total }),
        };
    });

    res.status(200).json({
        queue: result.queue,
        data: result.queue,
        pagination: result.pagination,
    });
};

export const getQueuePosition = async (req, res) => {
    const appointmentId = requireObjectId(req.params.appointmentId, 'appointmentId');

    const queueEntry = await QueueEntry.findOne({ appointment_id: appointmentId })
        .populate(queuePopulate)
        .maxTimeMS(5000)
        .lean({ virtuals: true });

    if (!queueEntry) throw new AppError('Queue entry not found', 404);

    const data = serializeQueueEntry(queueEntry);
    res.status(200).json({ queueEntry: data, data });
};

export const updateQueueStatus = async (req, res) => {
    const id = requireObjectId(req.params.id, 'queueEntryId');
    const status = normalizeStatus(req.body.status, QUEUE_STATUSES);

    const updates = { status };
    if (status === 'called') updates.called_at = new Date();

    const queueEntry = await QueueEntry.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
    }).populate(queuePopulate);

    if (!queueEntry) throw new AppError('Queue entry not found', 404);

    const appointmentStatus = status === 'no_show' ? 'no_show' : status;
    if (['waiting', 'called', 'in_consultation', 'completed', 'no_show'].includes(appointmentStatus)) {
        await Appointment.findByIdAndUpdate(
            queueEntry.appointment_id?._id || queueEntry.appointment_id,
            { status: appointmentStatus },
            { runValidators: true },
        );
    }

    await invalidateCache(['queue:*', 'appointments:*', 'dashboard:*']);

    const normalized = normalizeStatusValue(status);
    const payload = {
        queue_id: queueEntry._id.toString(),
        appointment_id: queueEntry.appointment_id?._id?.toString?.() || queueEntry.appointment_id?.toString?.(),
        doctor_id: queueEntry.appointment_id?.doctor_id?._id?.toString?.(),
        status: normalized,
    };

    emitQueueEvent('queue.updated', payload);
    emitQueueEvent(queueEvent(normalized), payload);

    const data = serializeQueueEntry(queueEntry);
    res.status(200).json({
        message: 'Queue status updated successfully',
        queueEntry: data,
        data,
    });
};
