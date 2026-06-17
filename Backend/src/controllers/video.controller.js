import axios from 'axios';
import jwt from 'jsonwebtoken';
import {
    Appointment,
    AuditLog,
    Doctor,
    MedicalDocument,
    Prescription,
    User,
} from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId, serialize, serializeMany } from '../utils/mongo.js';
import { env } from '../config/env.js';
import { emitToUser } from '../services/realtime.service.js';
import { invalidateCache } from '../services/cache.service.js';
import { agoraChannelFor, generateRtcToken, isAgoraConfigured, uidForRole } from '../services/agora.service.js';

const DAILY_API_URL = process.env.DAILY_API_URL || 'https://api.daily.co/v1';

function createCallToken({ appointmentId, userId, role }) {
    return jwt.sign(
        {
            type: 'video-call',
            appointmentId: appointmentId.toString(),
            userId: userId.toString(),
            role,
        },
        env.JWT_SECRET,
        { expiresIn: '4h' },
    );
}

function readCallToken(req) {
    const authorization = String(req.get('authorization') || '');
    if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim();
    return String(req.query.token || req.body?.token || '').trim();
}

async function resolveCallSession(req, { doctorOnly = false } = {}) {
    const token = readCallToken(req);
    if (!token) throw new AppError('Consultation token is required', 401);

    let payload;
    try {
        payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
        throw new AppError('Consultation link is invalid or expired', 401);
    }

    if (payload.type !== 'video-call' || !payload.appointmentId || !payload.userId || !payload.role) {
        throw new AppError('Invalid consultation token', 401);
    }
    if (doctorOnly && payload.role !== 'doctor') {
        throw new AppError('Only the assigned doctor can update this consultation', 403);
    }

    const appointment = await Appointment.findById(
        requireObjectId(payload.appointmentId, 'appointmentId'),
    );
    if (!appointment) throw new AppError('Appointment not found', 404);

    let doctor = null;
    if (payload.role === 'patient') {
        if (String(appointment.patient_id) !== String(payload.userId)) {
            throw new AppError('This consultation does not belong to the patient', 403);
        }
    } else if (payload.role === 'doctor') {
        doctor = await Doctor.findOne({ user_id: payload.userId }).select('_id user_id name specialty').lean();
        if (!doctor || String(appointment.doctor_id) !== String(doctor._id)) {
            throw new AppError('This consultation is assigned to another doctor', 403);
        }
    } else {
        throw new AppError('Unsupported consultation role', 403);
    }

    return { appointment, doctor, payload };
}

function webRtcCallUrl({ appointmentId, userId, role, baseUrl = env.CALL_WEB_BASE_URL }) {
    const token = createCallToken({ appointmentId, userId, role });
    const url = new URL('/video-call', `${baseUrl.replace(/\/+$/, '')}/`);
    url.searchParams.set('token', token);
    return url.toString();
}

function callBaseUrlFor(role) {
    return role === 'doctor' ? env.DOCTOR_CALL_WEB_BASE_URL : env.PATIENT_CALL_WEB_BASE_URL;
}

async function webRtcRoom(appointment, appointmentId, userId, role, baseUrl) {
    const name = `appointment-${appointmentId}`;
    if (
        appointment.video_room_name !== name ||
        appointment.appointment_type !== 'video' ||
        appointment.video_room_url
    ) {
        appointment.video_room_name = name;
        // Remove stale hosted-provider URLs from earlier Daily/Jitsi sessions.
        // Daily support remains available when VIDEO_PROVIDER=daily is selected.
        appointment.video_room_url = undefined;
        appointment.appointment_type = 'video';
        await appointment.save();
    }

    return {
        url: webRtcCallUrl({ appointmentId, userId, role, baseUrl }),
        name,
        provider: 'webrtc',
        message: 'Private video consultation ready',
    };
}

function dailyHeaders() {
    return {
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Role-aware access check. Returns the resolved doctor (for doctor callers) so
 * we can use its name when ringing the patient.
 */
async function resolveAccess(req, appointment) {
    const role = req.userRole;
    if (role === 'admin' || role === 'management' || role === 'receptionist') {
        return { allowed: true, doctor: null };
    }
    if (role === 'patient') {
        return { allowed: req.user.id === appointment.patient_id.toString(), doctor: null };
    }
    if (role === 'doctor') {
        const doctor = await Doctor.findOne({ user_id: req.user.id }).select('_id name').lean();
        const allowed = Boolean(doctor) && doctor._id.toString() === appointment.doctor_id.toString();
        return { allowed, doctor };
    }
    return { allowed: false, doctor: null };
}

const isDailyRoomUrl = (url) => {
    if (!url) return false;
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host.endsWith('.daily.co') && host !== 'example.daily.co';
    } catch {
        return false;
    }
};

async function agoraRoom(appointment, appointmentId, userId, role, baseUrl) {
    if (!isAgoraConfigured()) throw new AppError('Agora App ID / App Certificate are not configured', 500);
    const channel = agoraChannelFor(appointmentId);
    if (appointment.video_room_name !== channel || appointment.appointment_type !== 'video' || appointment.video_room_url) {
        appointment.video_room_name = channel;
        appointment.video_room_url = undefined; // Agora is token+channel based, not URL based
        appointment.appointment_type = 'video';
        await appointment.save();
    }
    const cred = generateRtcToken({ channel, uid: uidForRole(role) });
    return {
        provider: 'agora',
        name: channel,
        channel,
        appId: cred.appId,
        token: cred.token,
        uid: cred.uid,
        expiresAt: cred.expiresAt,
        // The signed page lets the rung patient (mobile browser) fetch its own token.
        url: webRtcCallUrl({ appointmentId, userId, role, baseUrl }),
        message: 'Agora call ready',
    };
}

async function jitsiRoom(appointment, appointmentId, userId, role, baseUrl) {
    const name = `indus-appointment-${appointmentId}`;
    const meetingUrl = `${env.JITSI_BASE_URL.replace(/\/+$/, '')}/${name}#config.prejoinPageEnabled=false&config.disableDeepLinking=true`;
    if (appointment.video_room_url !== meetingUrl || appointment.video_room_name !== name) {
        appointment.video_room_url = meetingUrl;
        appointment.video_room_name = name;
        appointment.appointment_type = 'video';
        await appointment.save();
    }
    return {
        url: role === 'doctor'
            ? webRtcCallUrl({ appointmentId, userId, role, baseUrl })
            : meetingUrl,
        meetingUrl,
        name,
        provider: 'jitsi',
        message: 'Jitsi room ready',
    };
}

async function dailyRoom(appointment, appointmentId) {
    if (!process.env.DAILY_API_KEY) throw new AppError('Daily.co API key not configured', 500);

    if (appointment.video_room_url && appointment.video_room_name && isDailyRoomUrl(appointment.video_room_url)) {
        return { url: appointment.video_room_url, name: appointment.video_room_name, provider: 'daily', message: 'Joining existing video room' };
    }

    const name = `appt-${appointmentId}`;
    const persist = async (room) => {
        appointment.video_room_url = room.url;
        appointment.video_room_name = room.name;
        appointment.appointment_type = 'video';
        await appointment.save();
    };

    try {
        const { data: room } = await axios.post(
            `${DAILY_API_URL}/rooms`,
            {
                name,
                privacy: 'public',
                properties: {
                    max_participants: 2,
                    enable_screenshare: true,
                    enable_chat: true,
                    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
                    eject_at_room_exp: true,
                },
            },
            { headers: dailyHeaders() },
        );
        await persist(room);
        return { url: room.url, name: room.name, provider: 'daily', message: 'Video room created successfully' };
    } catch (error) {
        const body = JSON.stringify(error.response?.data || '');
        if (error.response?.status === 400 && /already exists/i.test(body)) {
            const { data: room } = await axios.get(`${DAILY_API_URL}/rooms/${name}`, { headers: dailyHeaders() });
            await persist(room);
            return { url: room.url, name: room.name, provider: 'daily', message: 'Joining existing video room' };
        }
        console.error('Error creating video room:', error.response?.data || error.message);
        throw new AppError('Failed to create video room', 500);
    }
}

/**
 * POST /api/v1/video/create-room
 *
 * Resolves the room (private WebRTC by default). When the DOCTOR starts the call, the
 * patient is rung in real time (`call:incoming`) so they get an alert and can
 * accept/decline.
 */
export const createVideoRoom = async (req, res) => {
    const appointmentId = requireObjectId(req.body.appointmentId || req.body.appointment_id, 'appointmentId');

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) throw new AppError('Appointment not found', 404);

    const { allowed, doctor } = await resolveAccess(req, appointment);
    if (!allowed) throw new AppError('Unauthorized to join this consultation', 403);

    // Auto-select Agora when it's configured; fall back to webrtc otherwise.
    const defaultProvider = isAgoraConfigured() ? 'agora' : 'webrtc';
    const provider = String(req.body.provider || env.VIDEO_PROVIDER || defaultProvider).toLowerCase();
    const callerBaseUrl = callBaseUrlFor(req.userRole);
    const room = provider === 'daily'
        ? await dailyRoom(appointment, appointmentId)
        : provider === 'jitsi'
            ? await jitsiRoom(appointment, appointmentId, req.user.id, req.userRole, callerBaseUrl)
            : provider === 'agora'
                ? await agoraRoom(appointment, appointmentId, req.user.id, req.userRole, callerBaseUrl)
                : await webRtcRoom(appointment, appointmentId, req.user.id, req.userRole, callerBaseUrl);

    // Doctor initiated → ring the patient. webrtc + agora send the patient to the
    // signed /video-call page (it fetches its own per-role token there).
    if (req.userRole === 'doctor') {
        const patientRoomUrl = room.provider === 'webrtc' || room.provider === 'agora'
            ? webRtcCallUrl({
                appointmentId,
                userId: appointment.patient_id,
                role: 'patient',
                baseUrl: env.PATIENT_CALL_WEB_BASE_URL,
            })
            : room.provider === 'jitsi'
                ? room.meetingUrl
            : room.url;
        emitToUser(appointment.patient_id.toString(), 'call:incoming', {
            appointmentId: appointmentId.toString(),
            roomUrl: patientRoomUrl,
            provider: room.provider,
            doctorName: doctor?.name ? `Dr. ${doctor.name}` : 'Your doctor',
            token: appointment.token,
            time: appointment.time,
        });
    }

    res.status(200).json({
        message: room.message,
        provider: room.provider,
        // Agora callers also receive their channel/token/appId to join immediately.
        room: {
            url: room.url,
            name: room.name,
            provider: room.provider,
            ...(room.provider === 'agora'
                ? { channel: room.channel, appId: room.appId, token: room.token, uid: room.uid, expiresAt: room.expiresAt }
                : {}),
        },
    });
};

/**
 * GET /api/v1/video/agora-token?token=<call-jwt>
 * The signed /video-call page (patient mobile browser / doctor) fetches a fresh
 * per-role Agora token here.
 */
export const getAgoraToken = async (req, res) => {
    const { appointment, payload } = await resolveCallSession(req);
    const channel = agoraChannelFor(appointment._id);
    const cred = generateRtcToken({ channel, uid: uidForRole(payload.role) });
    res.status(200).json({ provider: 'agora', role: payload.role, ...cred });
};

/**
 * GET /api/v1/video/agora-test-token?channel=indus-test&uid=0
 * Dev-only helper so a standalone test page can confirm Agora connectivity
 * without a real appointment. Disabled in production.
 */
export const getAgoraTestToken = async (req, res) => {
    if (env.IS_PRODUCTION) throw new AppError('Not available in production', 404);
    const channel = String(req.query.channel || 'indus-test').slice(0, 64);
    const uid = Number(req.query.uid) || 0;
    const cred = generateRtcToken({ channel, uid });
    res.status(200).json({ provider: 'agora', ...cred });
};

/**
 * POST /api/v1/video/decline
 * Patient declines an incoming call; the doctor is notified with the reason.
 */
export const declineVideoCall = async (req, res) => {
    const appointmentId = requireObjectId(req.body.appointmentId || req.body.appointment_id, 'appointmentId');
    const reason = String(req.body.reason || '').trim().slice(0, 300);

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) throw new AppError('Appointment not found', 404);

    if (req.userRole === 'patient' && req.user.id !== appointment.patient_id.toString()) {
        throw new AppError('Unauthorized', 403);
    }

    const [doctor, patient] = await Promise.all([
        Doctor.findById(appointment.doctor_id).select('user_id name').lean(),
        User.findById(appointment.patient_id).select('name').lean(),
    ]);

    if (doctor?.user_id) {
        emitToUser(doctor.user_id.toString(), 'call:declined', {
            appointmentId: appointmentId.toString(),
            reason,
            patientName: patient?.name || 'The patient',
        });
    }

    res.status(200).json({ message: 'Call declined', data: { appointmentId: appointmentId.toString(), reason } });
};

/**
 * GET /api/v1/video/context
 * Appointment-scoped clinical data for the signed patient/doctor call link.
 */
export const getVideoContext = async (req, res) => {
    const { appointment: baseAppointment, payload } = await resolveCallSession(req);
    const appointment = await Appointment.findById(baseAppointment._id)
        .populate('patient_id', 'name email phone date_of_birth gender blood_group allergies medical_history')
        .populate('doctor_id', 'name specialty qualification experience_years')
        .populate('department_id', 'name')
        .lean({ virtuals: true });

    const [documents, prescription] = await Promise.all([
        MedicalDocument.find({ appointment_id: baseAppointment._id })
            .sort({ created_at: -1 })
            .lean({ virtuals: true }),
        Prescription.findOne({ appointment_id: baseAppointment._id })
            .sort({ updated_at: -1 })
            .lean({ virtuals: true }),
    ]);

    res.status(200).json({
        role: payload.role,
        appointment: serialize(appointment),
        documents: serializeMany(documents),
        prescription: serialize(prescription),
    });
};

/**
 * GET /api/v1/video/documents/:id
 * Opens only files uploaded for this exact appointment.
 */
export const getVideoDocument = async (req, res) => {
    const { appointment } = await resolveCallSession(req);
    const document = await MedicalDocument.findOne({
        _id: requireObjectId(req.params.id, 'documentId'),
        appointment_id: appointment._id,
        patient_id: appointment.patient_id,
    }).select('+data').lean({ virtuals: true });

    if (!document) throw new AppError('Consultation document not found', 404);
    const data = serialize(document);
    res.status(200).json({ document: data, data });
};

/**
 * PUT /api/v1/video/prescription
 * Doctor-only upsert tied to the appointment encoded in the call token.
 */
export const saveVideoPrescription = async (req, res) => {
    const { appointment, doctor, payload } = await resolveCallSession(req, { doctorOnly: true });
    const medications = Array.isArray(req.body.medications)
        ? req.body.medications
            .map((item) => ({
                name: String(item?.name || '').trim().slice(0, 140),
                dosage: String(item?.dosage || '').trim().slice(0, 100),
                frequency: String(item?.frequency || '').trim().slice(0, 100),
                duration: String(item?.duration || '').trim().slice(0, 100),
            }))
            .filter((item) => item.name)
        : [];

    if (medications.length === 0) throw new AppError('Add at least one medication', 400);

    const updates = {
        doctor_id: doctor._id,
        patient_id: appointment.patient_id,
        diagnosis: String(req.body.diagnosis || '').trim().slice(0, 1000),
        medications,
        instructions: String(req.body.instructions || '').trim().slice(0, 3000),
        notes: String(req.body.notes || '').trim().slice(0, 3000),
        follow_up_date: String(req.body.follow_up_date || req.body.followUpDate || '').trim(),
        valid_until: String(req.body.valid_until || req.body.validUntil || '').trim(),
    };

    const prescription = await Prescription.findOneAndUpdate(
        { appointment_id: appointment._id },
        { $set: updates, $setOnInsert: { appointment_id: appointment._id } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    await Appointment.findByIdAndUpdate(appointment._id, {
        diagnosis: updates.diagnosis,
        prescription: medications.map((item) => item.name).join(', '),
        notes: updates.notes,
    });
    await AuditLog.create({
        user_id: payload.userId,
        action: 'prescription.saved_during_video',
        collection_name: 'prescriptions',
        record_id: prescription._id,
        new_data: updates,
        ip_address: req.ip,
        user_agent: req.get('user-agent'),
    });
    await invalidateCache(['prescriptions:*', 'appointments:*', 'dashboard:*']);

    const data = serialize(await Prescription.findById(prescription._id)
        .populate('appointment_id', 'token date time status chief_complaint')
        .populate('doctor_id', 'name specialty')
        .populate('patient_id', 'name email phone'));

    emitToUser(String(appointment.patient_id), 'prescription.updated', {
        appointmentId: String(appointment._id),
        prescription: data,
    });
    res.status(200).json({ message: 'Prescription saved for the patient', prescription: data, data });
};
