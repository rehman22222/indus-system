import axios from 'axios';
import { Appointment, Doctor } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireObjectId } from '../utils/mongo.js';
import { env } from '../config/env.js';

const DAILY_API_URL = process.env.DAILY_API_URL || 'https://api.daily.co/v1';

function dailyHeaders() {
    return {
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Role-aware access check. Doctor ownership is resolved from the doctors
 * collection (appointment.doctor_id references a doctor, not a user).
 */
async function userCanAccessAppointment(req, appointment) {
    const role = req.userRole;
    if (role === 'admin' || role === 'management' || role === 'receptionist') return true;
    if (role === 'patient') return req.user.id === appointment.patient_id.toString();
    if (role === 'doctor') {
        const doctor = await Doctor.findOne({ user_id: req.user.id }).select('_id').lean();
        return Boolean(doctor) && doctor._id.toString() === appointment.doctor_id.toString();
    }
    return false;
}

function roomResponse(res, room, message, provider) {
    return res.status(200).json({
        message,
        provider,
        room: { url: room.url, name: room.name, provider },
    });
}

/**
 * Jitsi Meet: free, no API key. The room is a deterministic public URL keyed by
 * appointment id, so the doctor (web) and patient (mobile) always land in the
 * same meeting. No external call needed.
 */
async function createJitsiRoom(req, res, appointment, appointmentId) {
    const roomName = `indus-appointment-${appointmentId}`;
    const url = `${env.JITSI_BASE_URL.replace(/\/+$/, '')}/${roomName}`;

    if (appointment.video_room_url !== url || appointment.video_room_name !== roomName) {
        appointment.video_room_url = url;
        appointment.video_room_name = roomName;
        appointment.appointment_type = 'video';
        await appointment.save();
    }

    return roomResponse(res, { url, name: roomName }, 'Jitsi room ready', 'jitsi');
}

/**
 * Daily.co: idempotent, reuses the stored room. Requires DAILY_API_KEY.
 */
async function createDailyRoom(req, res, appointment, appointmentId) {
    if (!process.env.DAILY_API_KEY) {
        throw new AppError('Daily.co API key not configured', 500);
    }

    const isPlaceholder = (url) => !url || /example\.daily\.co/i.test(url) || /meet\.jit\.si/i.test(url);
    if (appointment.video_room_url && appointment.video_room_name && !isPlaceholder(appointment.video_room_url)) {
        return roomResponse(res, { url: appointment.video_room_url, name: appointment.video_room_name }, 'Joining existing video room', 'daily');
    }

    const roomName = `appt-${appointmentId}`;
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
                name: roomName,
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
        return roomResponse(res, room, 'Video room created successfully', 'daily');
    } catch (error) {
        const body = JSON.stringify(error.response?.data || '');
        if (error.response?.status === 400 && /already exists/i.test(body)) {
            try {
                const { data: room } = await axios.get(`${DAILY_API_URL}/rooms/${roomName}`, { headers: dailyHeaders() });
                await persist(room);
                return roomResponse(res, room, 'Joining existing video room', 'daily');
            } catch {
                /* fall through */
            }
        }
        console.error('Error creating video room:', error.response?.data || error.message);
        throw new AppError('Failed to create video room', 500);
    }
}

/**
 * POST /api/v1/video/create-room
 *
 * Returns the consultation room for an appointment using the configured
 * VIDEO_PROVIDER (default: jitsi — free, no API key). Both doctor and patient
 * resolve the same room URL stored on the appointment.
 */
export const createVideoRoom = async (req, res) => {
    const appointmentId = requireObjectId(req.body.appointmentId || req.body.appointment_id, 'appointmentId');

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) throw new AppError('Appointment not found', 404);

    if (!(await userCanAccessAppointment(req, appointment))) {
        throw new AppError('Unauthorized to join this consultation', 403);
    }

    const provider = String(req.body.provider || env.VIDEO_PROVIDER || 'jitsi').toLowerCase();

    if (provider === 'daily') {
        return createDailyRoom(req, res, appointment, appointmentId);
    }
    return createJitsiRoom(req, res, appointment, appointmentId);
};
