import { Appointment, AuditLog, Doctor, QueueEntry, Slot, SystemSetting, User } from '../models/index.js';
import { serializeMany } from '../utils/mongo.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize } from '../utils/mongo.js';
import { buildSort, getListOptions, getPaginationMeta } from '../utils/api.js';
import { cacheKey, getOrSetCache } from '../services/cache.service.js';
import { invalidateCache } from '../services/cache.service.js';
import { emitQueueEvent } from '../services/realtime.service.js';

export const getManagementDashboard = async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const key = cacheKey('dashboard:management', { date });

    const data = await getOrSetCache(key, 30, async () => {
        const [
            dailyAppointments,
            completed,
            cancelled,
            noShow,
            activeDoctors,
            activePatients,
            activeQueue,
            availableSlots,
        ] = await Promise.all([
            Appointment.countDocuments({ date }).maxTimeMS(5000),
            Appointment.countDocuments({ date, status: 'completed' }).maxTimeMS(5000),
            Appointment.countDocuments({ date, status: 'cancelled' }).maxTimeMS(5000),
            Appointment.countDocuments({ date, status: 'no_show' }).maxTimeMS(5000),
            Doctor.countDocuments({ is_active: true, is_available: true }).maxTimeMS(5000),
            User.countDocuments({ role: 'patient', is_active: true }).maxTimeMS(5000),
            QueueEntry.countDocuments({ status: { $in: ['waiting', 'called', 'in_consultation'] } }).maxTimeMS(5000),
            Slot.countDocuments({ date, is_available: true }).maxTimeMS(5000),
        ]);

        return {
            date,
            dailyAppointments,
            completed,
            cancelled,
            noShow,
            activeDoctors,
            activePatients,
            activeQueue,
            availableSlots,
            completionRate: dailyAppointments ? Number((completed / dailyAppointments).toFixed(3)) : 0,
        };
    });

    res.status(200).json({ dashboard: data, data });
};

export const getOperationalAppointments = async (req, res) => {
    const list = getListOptions(req.query);
    const filter = {};
    if (req.query.date) filter.date = req.query.date;
    if (req.query.status) filter.status = req.query.status;

    const sort = buildSort(req.query, {
        allowed: ['date', 'time', 'status', 'created_at'],
        fallback: { date: -1, time: -1 },
    });

    const [appointments, total] = await Promise.all([
        Appointment.find(filter)
            .select('token date time status appointment_type doctor_id patient_id department_id')
            .populate([
                { path: 'doctor_id', select: 'name specialty' },
                { path: 'patient_id', select: 'name email phone' },
                { path: 'department_id', select: 'name' },
            ])
            .sort(sort)
            .skip(list.skip)
            .limit(list.limit)
            .maxTimeMS(5000)
            .lean({ virtuals: true }),
        Appointment.countDocuments(filter).maxTimeMS(5000),
    ]);

    const data = serializeMany(appointments);
    res.status(200).json({
        appointments: data,
        data,
        pagination: getPaginationMeta({ page: list.page, limit: list.limit, total }),
    });
};

export const setSlotBlocking = async (req, res) => {
    const blocked = Boolean(req.body.blocked);

    await SystemSetting.findOneAndUpdate(
        { setting_key: 'slots_blocked' },
        {
            setting_key: 'slots_blocked',
            setting_value: { blocked, changed_at: new Date().toISOString() },
            description: 'Global appointment booking switch',
            updated_by: req.user?.id,
        },
        { upsert: true, new: true, runValidators: true },
    );

    await AuditLog.create({
        user_id: req.user?.id,
        action: blocked ? 'slots.blocked_all' : 'slots.unblocked_all',
        collection_name: 'slots',
        new_data: { blocked },
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['slots:*', 'doctor-schedule:*', 'dashboard:*']);
    emitQueueEvent('queue.updated', { reason: blocked ? 'slots.blocked' : 'slots.unblocked' });

    res.status(200).json({
        message: blocked ? 'Online appointment booking blocked' : 'Online appointment booking reopened',
        data: { blocked },
    });
};

function addMinutes(time, minutes) {
    const [hours, mins] = String(time).split(':').map(Number);
    const total = hours * 60 + mins + minutes;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export const addEmergencySlots = async (req, res) => {
    const doctorId = requireObjectId(req.params.doctorId, 'doctorId');
    const date = String(req.body.date || new Date().toISOString().slice(0, 10));
    const count = Math.min(Math.max(Number(req.body.count) || 5, 1), 20);
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.is_active) throw new AppError('Doctor not found', 404);

    const latest = await Slot.findOne({ doctor_id: doctorId, date }).sort({ start_time: -1 }).lean();
    const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const configured = doctor.available_hours?.[day] || doctor.available_hours || {};
    const duration = doctor.average_consultation_time || 30;
    let start = latest?.end_time || configured.start || '09:00';
    const created = [];

    for (let index = 0; index < count; index += 1) {
        const end = addMinutes(start, duration);
        const slot = await Slot.findOneAndUpdate(
            { doctor_id: doctorId, date, start_time: start },
            { doctor_id: doctorId, date, start_time: start, end_time: end, is_available: true, max_patients: 1, current_patients: 0 },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
        created.push(slot);
        start = end;
    }

    doctor.max_patients_per_day += count;
    await doctor.save();
    await AuditLog.create({
        user_id: req.user?.id,
        action: 'slots.emergency_added',
        collection_name: 'slots',
        record_id: doctor._id,
        new_data: { doctor_id: doctorId, date, count },
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['slots:*', 'doctors:*', `doctor-schedule:${doctorId}:*`, 'dashboard:*']);
    emitQueueEvent('queue.updated', { doctor_id: doctorId.toString(), reason: 'emergency_slots.added' });

    res.status(201).json({ message: `${created.length} emergency slots added`, slots: created.map(serialize), data: created.map(serialize) });
};
