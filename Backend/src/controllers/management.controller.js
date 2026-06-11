import { Appointment, Doctor, QueueEntry, Slot, User } from '../models/index.js';
import { serializeMany } from '../utils/mongo.js';
import { buildSort, getListOptions, getPaginationMeta } from '../utils/api.js';
import { cacheKey, getOrSetCache } from '../services/cache.service.js';

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
