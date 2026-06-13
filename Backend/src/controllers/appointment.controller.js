import mongoose from '../config/mongodb.js';
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
import { requireObjectId, serialize } from '../utils/mongo.js';
import { enqueueNotification } from '../services/notificationQueue.service.js';
import {
    APPOINTMENT_STATUSES,
    buildListFilter,
    buildProjection,
    buildSort,
    getListOptions,
    getPaginationMeta,
    normalizeStatus,
    normalizeStatusValue,
    pagedFind,
} from '../utils/api.js';
import { cacheKey, getOrSetCache, invalidateCache } from '../services/cache.service.js';
import { emitQueueEvent } from '../services/realtime.service.js';

const appointmentPopulate = [
    { path: 'patient_id', select: 'email phone name role date_of_birth gender blood_group allergies medical_history' },
    { path: 'doctor_id', select: 'name specialty consultation_fee average_consultation_time' },
    { path: 'department_id', select: 'name description floor_number' },
    { path: 'slot_id', select: 'date start_time end_time max_patients current_patients is_available' },
];

const FIELD_MAP = {
    appointment_date: 'date',
    appointment_time: 'time',
    no_show_score: 'no_show_risk_score',
    doctorId: 'doctor_id',
    patientId: 'patient_id',
};

const SORT_FIELDS = ['created_at', 'updated_at', 'date', 'time', 'status', 'doctor_id', 'patient_id'];
const PROJECTION_FIELDS = [
    '_id',
    'id',
    'token',
    'patient_id',
    'doctor_id',
    'department_id',
    'slot_id',
    'date',
    'time',
    'appointment_type',
    'visit_type',
    'status',
    'chief_complaint',
    'history_summary',
    'diagnosis',
    'notes',
    'no_show_risk_score',
    'governance_status',
    'video_room_url',
    'video_room_name',
    'consent_recorded',
    'consent_recorded_at',
    'check_in_time',
    'consultation_start_time',
    'consultation_end_time',
    'created_at',
    'updated_at',
];

const activeStatuses = ['scheduled', 'confirmed', 'waiting', 'called', 'in_consultation'];

function generateToken() {
    const prefix = 'APT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

async function generateUniqueToken(session) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const token = generateToken();
        const exists = await Appointment.exists({ token }).session(session);
        if (!exists) return token;
    }

    throw new AppError('Unable to generate unique appointment token', 500);
}

async function currentDoctorId(req) {
    if (req.userRole !== 'doctor') return null;
    const doctor = await Doctor.findOne({ user_id: req.user.id }).select('_id').lean();
    if (!doctor) throw new AppError('Doctor profile not found', 403);
    return doctor._id;
}

async function scopedAppointmentFilter(req, base = {}) {
    const filter = { ...base };

    if (req.userRole === 'patient') {
        filter.patient_id = requireObjectId(req.user.id, 'patientId');
    }

    if (req.userRole === 'doctor') {
        filter.doctor_id = await currentDoctorId(req);
    }

    return filter;
}

function appointmentEvent(status) {
    switch (status) {
        case 'waiting':
            return 'patient.checked_in';
        case 'called':
            return 'patient.called';
        case 'in_consultation':
            return 'consultation.started';
        case 'completed':
            return 'consultation.completed';
        case 'cancelled':
            return 'appointment.cancelled';
        default:
            return 'queue.updated';
    }
}

async function invalidateAppointmentCaches(appointment = {}) {
    await invalidateCache([
        'appointments:*',
        'slots:*',
        'queue:*',
        'dashboard:*',
        'analytics:*',
        appointment.doctor_id ? `doctor-schedule:${appointment.doctor_id}:*` : '',
    ].filter(Boolean));
}

function titleCase(value) {
    if (!value) return value;
    return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
}

function serializeAppointment(row) {
    const value = serialize(row);
    const patient = value && typeof value.patient_id === 'object' ? value.patient_id : null;
    const doctor = value && typeof value.doctor_id === 'object' ? value.doctor_id : null;
    const department = value && typeof value.department_id === 'object' ? value.department_id : null;
    const slot = value && typeof value.slot_id === 'object' ? value.slot_id : null;

    return {
        ...value,
        status: normalizeStatusValue(value.status),
        patient_id: patient?.id || value.patient_id,
        doctor_id: doctor?.id || value.doctor_id,
        department_id: department?.id || value.department_id,
        slot_id: slot?.id || value.slot_id,
        appointment_date: value.date,
        appointment_time: value.time,
        no_show_score: value.no_show_risk_score,
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

function serializeAppointments(rows = []) {
    return rows.map(serializeAppointment);
}

function withRequiredProjectionFields(projection) {
    if (!projection) return projection;
    const fields = new Set(projection.split(/\s+/).filter(Boolean));
    for (const field of ['patient_id', 'doctor_id', 'department_id', 'slot_id', 'date', 'time', 'status', 'no_show_risk_score']) {
        fields.add(field);
    }
    return Array.from(fields).join(' ');
}

export const getAllAppointments = async (req, res) => {
    const list = getListOptions(req.query);
    const rawFilter = buildListFilter(req, {
        fieldMap: FIELD_MAP,
        statusAllowed: APPOINTMENT_STATUSES,
    });
    const filter = await scopedAppointmentFilter(req, rawFilter);
    const sort = buildSort(req.query, {
        fieldMap: FIELD_MAP,
        allowed: SORT_FIELDS,
        fallback: { date: -1, time: -1 },
    });
    const projection = withRequiredProjectionFields(buildProjection(req.query, PROJECTION_FIELDS, FIELD_MAP));

    const key = cacheKey('appointments:list', {
        user: req.user?.id,
        role: req.userRole,
        ...req.query,
    });

    const result = await getOrSetCache(key, 20, async () => {
        const { items, pagination } = await pagedFind(Appointment, filter, {
            ...list,
            sort,
            projection,
            populate: appointmentPopulate,
            maxTimeMS: 5000,
        });
        return { appointments: serializeAppointments(items), pagination };
    });

    res.status(200).json({ ...result, data: result.appointments });
};

export const getAppointmentById = async (req, res) => {
    const id = requireObjectId(req.params.id, 'appointmentId');
    const filter = await scopedAppointmentFilter(req, { _id: id });

    const appointment = await Appointment.findOne(filter)
        .populate(appointmentPopulate)
        .maxTimeMS(5000)
        .lean({ virtuals: true });

    if (!appointment) throw new AppError('Appointment not found', 404);

    const data = serializeAppointment(appointment);
    res.status(200).json({ appointment: data, data });
};

// Management can pause all online (patient self-service) booking via the
// `slots_blocked` system setting. Staff-created bookings are unaffected.
async function isOnlineBookingBlocked() {
    const setting = await SystemSetting.findOne({ setting_key: 'slots_blocked' })
        .select('setting_value')
        .maxTimeMS(3000)
        .lean();
    const value = setting?.setting_value;
    return Boolean(value && (value === true || value.blocked === true));
}

export const createAppointment = async (req, res) => {
    const patientId = requireObjectId(req.body.patientId || req.body.patient_id, 'patientId');
    const doctorId = requireObjectId(req.body.doctorId || req.body.doctor_id, 'doctorId');
    let departmentId = req.body.departmentId || req.body.department_id
        ? requireObjectId(req.body.departmentId || req.body.department_id, 'departmentId')
        : null;
    let slotId = req.body.slotId || req.body.slot_id
        ? requireObjectId(req.body.slotId || req.body.slot_id, 'slotId')
        : null;
    const date = req.body.date || req.body.appointment_date;
    const time = req.body.time || req.body.appointment_time;
    const appointmentType = req.body.appointmentType || req.body.appointment_type || 'physical';
    const visitTypeInput = String(req.body.visitType || req.body.visit_type || 'new').toLowerCase();
    const visitType = ['new', 'follow_up'].includes(visitTypeInput) ? visitTypeInput : 'new';

    if (!date || !time) throw new AppError('Date and time are required', 400);
    if (req.userRole === 'patient' && req.user.id !== patientId.toString()) {
        throw new AppError('Patients can only book their own appointments', 403);
    }
    if (req.userRole === 'patient' && (await isOnlineBookingBlocked())) {
        throw new AppError(
            'Online booking is temporarily closed by the hospital. Please try again later or contact reception.',
            423,
        );
    }

    let createdAppointment;
    let createdQueueEntry;
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const doctor = await Doctor.findById(doctorId)
                .select('department_id is_active')
                .session(session)
                .lean();
            if (!doctor || !doctor.is_active) {
                throw new AppError('Doctor not found or inactive', 404);
            }

            departmentId = doctor.department_id;
            if (!departmentId) {
                throw new AppError('Department is required for appointment booking', 400);
            }

            if (!slotId) {
                const matchingSlot = await Slot.findOne({
                    doctor_id: doctorId,
                    date,
                    start_time: time,
                })
                    .select('_id')
                    .session(session)
                    .lean();

                if (!matchingSlot) {
                    throw new AppError('No matching slot found for this doctor, date, and time', 409);
                }
                slotId = matchingSlot._id;
            }

            const duplicate = await Appointment.exists({
                patient_id: patientId,
                doctor_id: doctorId,
                slot_id: slotId,
                status: { $in: activeStatuses },
            }).session(session);

            if (duplicate) {
                throw new AppError('Duplicate active booking for this slot is not allowed', 409);
            }

            const reservedSlot = await Slot.findOneAndUpdate(
                {
                    _id: slotId,
                    doctor_id: doctorId,
                    date,
                    start_time: time,
                    is_available: true,
                    $expr: { $lt: ['$current_patients', '$max_patients'] },
                },
                [
                    {
                        $set: {
                            current_patients: { $add: ['$current_patients', 1] },
                            is_available: {
                                $lt: [{ $add: ['$current_patients', 1] }, '$max_patients'],
                            },
                        },
                    },
                ],
                { new: true, session },
            );

            if (!reservedSlot) {
                throw new AppError('Slot not available', 409);
            }

            const token = await generateUniqueToken(session);
            const [appointment] = await Appointment.create(
                [
                    {
                        patient_id: patientId,
                        doctor_id: doctorId,
                        department_id: departmentId,
                        slot_id: slotId,
                        date,
                        time,
                        token,
                        appointment_type: appointmentType,
                        visit_type: visitType,
                        chief_complaint: req.body.chiefComplaint || req.body.chief_complaint,
                        history_summary: req.body.historySummary || req.body.history_summary,
                        status: normalizeStatus(req.body.status || 'confirmed'),
                        no_show_risk_score: req.body.no_show_score ?? req.body.no_show_risk_score ?? 0,
                    },
                ],
                { session },
            );

            const lastQueueEntry = await QueueEntry.findOne({})
                .sort({ position: -1 })
                .select('position')
                .session(session)
                .lean();

            const [queueEntry] = await QueueEntry.create(
                [
                    {
                        appointment_id: appointment._id,
                        position: (lastQueueEntry?.position || 0) + 1,
                        status: 'waiting',
                    },
                ],
                { session },
            );

            await AuditLog.create(
                [
                    {
                        user_id: req.user?.id,
                        action: 'appointment.created',
                        collection_name: 'appointments',
                        record_id: appointment._id,
                        new_data: {
                            token,
                            patient_id: patientId,
                            doctor_id: doctorId,
                            slot_id: slotId,
                            date,
                            time,
                        },
                        ip_address: req.ip,
                        user_agent: req.get('user-agent'),
                    },
                ],
                { session },
            );

            await Notification.create(
                [
                    {
                        user_id: patientId,
                        title: 'Appointment Confirmed',
                        body: `Your appointment token is ${token}.`,
                        data: {
                            type: 'appointment_confirmed',
                            job_status: 'pending',
                            appointment_id: appointment._id.toString(),
                            token,
                        },
                    },
                ],
                { session },
            );

            createdAppointment = appointment;
            createdQueueEntry = queueEntry;
        });
    } finally {
        await session.endSession();
    }

    await invalidateAppointmentCaches(createdAppointment);

    emitQueueEvent('queue.updated', {
        appointment_id: createdAppointment._id.toString(),
        queue_id: createdQueueEntry._id.toString(),
        doctor_id: doctorId.toString(),
        status: createdAppointment.status,
    });

    // Best-effort async push delivery (the in-app notification was already
    // persisted in the transaction). Routed through the worker queue so the
    // booking response is never blocked on FCM.
    try {
        const patient = await User.findById(patientId).select('fcm_token push_tokens').lean();
        const pushToken =
            patient?.fcm_token ||
            patient?.push_tokens?.find((item) => item.provider === 'fcm' && item.token)?.token;
        if (pushToken) {
            await enqueueNotification({
                type: 'push',
                token: pushToken,
                title: 'Appointment Confirmed',
                body: `Your appointment token is ${createdAppointment.token}.`,
                data: {
                    type: 'appointment_confirmed',
                    appointment_id: createdAppointment._id.toString(),
                    token: createdAppointment.token,
                },
            });
        }
    } catch (error) {
        console.warn('Appointment push enqueue failed:', error.message);
    }

    const appointment = await Appointment.findById(createdAppointment._id)
        .populate(appointmentPopulate)
        .lean({ virtuals: true });
    const data = serializeAppointment(appointment);

    res.status(201).json({
        message: 'Appointment created successfully',
        appointment: data,
        data,
    });
};

export const updateAppointment = async (req, res) => {
    const id = requireObjectId(req.params.id, 'appointmentId');
    const updates = { ...req.body };

    if (updates.appointment_date !== undefined) updates.date = updates.appointment_date;
    if (updates.appointment_time !== undefined) updates.time = updates.appointment_time;
    if (updates.doctorId !== undefined) updates.doctor_id = updates.doctorId;
    if (updates.slotId !== undefined) updates.slot_id = updates.slotId;
    delete updates.appointment_date;
    delete updates.appointment_time;
    delete updates.doctorId;
    delete updates.slotId;

    delete updates.id;
    delete updates._id;
    delete updates.created_at;
    delete updates.updated_at;
    delete updates.patient_id;
    delete updates.patientId;
    delete updates.token;

    const filter = await scopedAppointmentFilter(req, { _id: id });
    const current = await Appointment.findOne(filter);
    if (!current) throw new AppError('Appointment not found', 404);

    if (updates.status) updates.status = normalizeStatus(updates.status);
    const schedulingChange = updates.doctor_id || updates.date || updates.time || updates.slot_id;
    if (schedulingChange && !['admin', 'management', 'receptionist'].includes(req.userRole)) {
        throw new AppError('Only authorized staff can reassign or reschedule appointments', 403);
    }

    const wasActive = activeStatuses.includes(normalizeStatusValue(current.status));
    const nextStatus = normalizeStatusValue(updates.status || current.status);
    const willBeActive = activeStatuses.includes(nextStatus);
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            let targetSlotId = current.slot_id;
            let targetDoctorId = updates.doctor_id ? requireObjectId(updates.doctor_id, 'doctorId') : current.doctor_id;
            const targetDate = updates.date || current.date;
            const targetTime = updates.time || current.time;
            let slotChanged = false;

            if (schedulingChange) {
                const doctor = await Doctor.findById(targetDoctorId).select('department_id is_active').session(session).lean();
                if (!doctor?.is_active) throw new AppError('Target doctor is not active', 409);
                updates.doctor_id = targetDoctorId;
                updates.department_id = doctor.department_id;

                const targetSlot = updates.slot_id
                    ? await Slot.findOne({ _id: requireObjectId(updates.slot_id, 'slotId'), doctor_id: targetDoctorId, date: targetDate, start_time: targetTime }).session(session)
                    : await Slot.findOne({ doctor_id: targetDoctorId, date: targetDate, start_time: targetTime }).session(session);
                if (!targetSlot) throw new AppError('No matching slot exists for the selected doctor, date, and time', 409);
                targetSlotId = targetSlot._id;
                updates.slot_id = targetSlotId;
                slotChanged = String(targetSlotId) !== String(current.slot_id);

                if ((slotChanged || !wasActive) && willBeActive) {
                    const reserved = await Slot.findOneAndUpdate(
                        { _id: targetSlotId, $expr: { $lt: ['$current_patients', '$max_patients'] } },
                        [{ $set: { current_patients: { $add: ['$current_patients', 1] }, is_available: { $lt: [{ $add: ['$current_patients', 1] }, '$max_patients'] } } }],
                        { new: true, session },
                    );
                    if (!reserved) throw new AppError('The selected slot is no longer available', 409);
                }
            }

            const shouldReleaseOld = wasActive && (!willBeActive || (schedulingChange && String(targetSlotId) !== String(current.slot_id)));
            if (shouldReleaseOld && current.slot_id) {
                await Slot.findByIdAndUpdate(
                    current.slot_id,
                    [{ $set: { current_patients: { $max: [{ $subtract: ['$current_patients', 1] }, 0] }, is_available: true } }],
                    { session },
                );
            }

            if (!wasActive && willBeActive && !schedulingChange && current.slot_id) {
                const reserved = await Slot.findOneAndUpdate(
                    { _id: current.slot_id, $expr: { $lt: ['$current_patients', '$max_patients'] } },
                    [{ $set: { current_patients: { $add: ['$current_patients', 1] }, is_available: { $lt: [{ $add: ['$current_patients', 1] }, '$max_patients'] } } }],
                    { new: true, session },
                );
                if (!reserved) throw new AppError('The appointment slot is no longer available', 409);
            }

            Object.assign(current, updates);
            await current.save({ session, validateModifiedOnly: true });
        });
    } finally {
        await session.endSession();
    }

    const appointment = await Appointment.findById(current._id).populate(appointmentPopulate);

    const normalizedStatus = normalizeStatusValue(appointment.status);
    if (updates.status) {
        const queueStatus = normalizedStatus === 'cancelled' ? 'no_show' : normalizedStatus;
        if (['waiting', 'called', 'in_consultation', 'completed', 'no_show'].includes(queueStatus)) {
            await QueueEntry.findOneAndUpdate(
                { appointment_id: appointment._id },
                {
                    status: queueStatus,
                    ...(queueStatus === 'called' ? { called_at: new Date() } : {}),
                },
                { new: true, runValidators: true },
            );
        }
    }

    await AuditLog.create({
        user_id: req.user?.id,
        action: 'appointment.updated',
        collection_name: 'appointments',
        record_id: appointment._id,
        new_data: updates,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });

    await invalidateAppointmentCaches(appointment);

    const payload = {
        appointment_id: appointment._id.toString(),
        doctor_id: appointment.doctor_id?._id?.toString?.() || appointment.doctor_id?.toString?.(),
        status: normalizedStatus,
    };
    emitQueueEvent('queue.updated', payload);
    emitQueueEvent(appointmentEvent(normalizedStatus), payload);

    const data = serializeAppointment(appointment);
    res.status(200).json({
        message: 'Appointment updated successfully',
        appointment: data,
        data,
    });
};

export const cancelAppointment = async (req, res) => {
    const id = requireObjectId(req.params.id, 'appointmentId');
    const session = await mongoose.startSession();
    let cancelledAppointment;

    try {
        await session.withTransaction(async () => {
            const appointment = await Appointment.findOne(await scopedAppointmentFilter(req, { _id: id })).session(session);
            if (!appointment) throw new AppError('Appointment not found', 404);

            appointment.status = 'cancelled';
            await appointment.save({ session });

            await QueueEntry.findOneAndUpdate(
                { appointment_id: appointment._id },
                { status: 'no_show' },
                { session, runValidators: true },
            );

            if (appointment.slot_id) {
                await Slot.findByIdAndUpdate(
                    appointment.slot_id,
                    [
                        {
                            $set: {
                                current_patients: { $max: [{ $subtract: ['$current_patients', 1] }, 0] },
                                is_available: true,
                            },
                        },
                    ],
                    { session },
                );
            }

            await AuditLog.create(
                [
                    {
                        user_id: req.user?.id,
                        action: 'appointment.cancelled',
                        collection_name: 'appointments',
                        record_id: appointment._id,
                        new_data: { status: 'cancelled' },
                        ip_address: req.ip,
                        user_agent: req.get('user-agent'),
                    },
                ],
                { session },
            );

            cancelledAppointment = appointment;
        });
    } finally {
        await session.endSession();
    }

    await invalidateAppointmentCaches(cancelledAppointment);
    emitQueueEvent('appointment.cancelled', {
        appointment_id: id.toString(),
        doctor_id: cancelledAppointment?.doctor_id?.toString?.(),
        status: 'cancelled',
    });

    res.status(200).json({
        message: 'Appointment cancelled successfully',
        data: { id: id.toString(), status: 'cancelled' },
    });
};

export const getPatientAppointments = async (req, res) => {
    const patientId = requireObjectId(req.params.patientId, 'patientId');
    if (req.userRole === 'patient' && req.user.id !== patientId.toString()) {
        throw new AppError('Unauthorized to view these appointments', 403);
    }

    req.query.patient_id = patientId.toString();
    return getAllAppointments(req, res);
};

export const getDoctorAppointments = async (req, res) => {
    const doctorId = requireObjectId(req.params.doctorId, 'doctorId');
    if (req.userRole === 'doctor') {
        const ownDoctorId = await currentDoctorId(req);
        if (ownDoctorId.toString() !== doctorId.toString()) {
            throw new AppError('Unauthorized to view these appointments', 403);
        }
    }

    req.query.doctor_id = doctorId.toString();
    return getAllAppointments(req, res);
};
