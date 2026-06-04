import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = process.env.DAILY_API_URL || 'https://api.daily.co/v1';

/**
 * Create a Daily.co video room
 */
export const createVideoRoom = async (req, res) => {
    const { appointmentId, patientId, doctorId } = req.body;

    if (!DAILY_API_KEY) {
        throw new AppError('Daily.co API key not configured', 500);
    }

    try {
        // Verify appointment exists
        const { data: appointment, error: aptError } = await supabaseAdmin
            .from('appointments')
            .select('id, patient_id, doctor_id, status')
            .eq('id', appointmentId)
            .single();

        if (aptError || !appointment) {
            throw new AppError('Appointment not found', 404);
        }

        // Verify user is part of the appointment
        if (appointment.patient_id !== patientId && appointment.doctor_id !== doctorId) {
            throw new AppError('Unauthorized to create room for this appointment', 403);
        }

        // Create room with Daily.co
        const roomName = `appointment-${appointmentId}-${Date.now()}`;
        const response = await axios.post(
            `${DAILY_API_URL}/rooms`,
            {
                name: roomName,
                privacy: 'private',
                properties: {
                    max_participants: 2,
                    enable_screenshare: true,
                    enable_chat: true,
                    start_video_off: false,
                    start_audio_off: false,
                    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2) // 2 hours expiry
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${DAILY_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const roomData = response.data;

        // Update appointment with room URL
        const { error: updateError } = await supabaseAdmin
            .from('appointments')
            .update({
                video_room_url: roomData.url,
                video_room_name: roomData.name,
                updated_at: new Date().toISOString()
            })
            .eq('id', appointmentId);

        if (updateError) {
            console.error('Failed to update appointment with room URL:', updateError);
        }

        res.status(200).json({
            message: 'Video room created successfully',
            room: {
                url: roomData.url,
                name: roomData.name,
                expires: new Date(roomData.config.exp * 1000).toISOString()
            }
        });
    } catch (error) {
        console.error('Error creating video room:', error.response?.data || error.message);
        throw new AppError('Failed to create video room', 500);
    }
};
