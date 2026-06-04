import { supabase, supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Generate unique appointment token
 */
const generateToken = () => {
    const prefix = 'APT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

/**
 * Get all appointments
 */
export const getAllAppointments = async (req, res) => {
    const { status, date, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
        .from('appointments')
        .select(`
      *,
      patient:users!patient_id(id, email, phone, name),
      doctor:doctors(id, name, specialty),
      department:departments(id, name)
    `, { count: 'exact' })
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .range(offset, offset + limit - 1);

    if (status) {
        query = query.eq('status', status);
    }

    if (date) {
        query = query.eq('date', date);
    }

    const { data, error, count } = await query;

    if (error) {
        throw new AppError('Failed to fetch appointments', 500);
    }

    res.status(200).json({
        appointments: data,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
        }
    });
};

/**
 * Get appointment by ID
 */
export const getAppointmentById = async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
        .from('appointments')
        .select(`
      *,
      patient:users!patient_id(*),
      doctor:doctors(*),
      department:departments(*),
      slot:slots(*)
    `)
        .eq('id', id)
        .single();

    if (error || !data) {
        throw new AppError('Appointment not found', 404);
    }

    // Check if user has permission to view this appointment
    if (req.userRole === 'patient' && data.patient_id !== req.user.id) {
        throw new AppError('Unauthorized to view this appointment', 403);
    }

    res.status(200).json({ appointment: data });
};

/**
 * Create new appointment
 */
export const createAppointment = async (req, res) => {
    const {
        patientId,
        doctorId,
        departmentId,
        slotId,
        date,
        time,
        chiefComplaint
    } = req.body;

    // Verify slot is available
    const { data: slot, error: slotError } = await supabaseAdmin
        .from('slots')
        .select('*')
        .eq('id', slotId)
        .eq('is_available', true)
        .single();

    if (slotError || !slot) {
        throw new AppError('Slot not available', 400);
    }

    // Generate token
    const token = generateToken();

    // Create appointment
    const { data: appointment, error: aptError } = await supabaseAdmin
        .from('appointments')
        .insert({
            patient_id: patientId,
            doctor_id: doctorId,
            department_id: departmentId,
            slot_id: slotId,
            date,
            time,
            token,
            chief_complaint: chiefComplaint,
            status: 'scheduled'
        })
        .select(`
      *,
      patient:users!patient_id(*),
      doctor:doctors(*),
      department:departments(*)
    `)
        .single();

    if (aptError) {
        throw new AppError('Failed to create appointment', 500);
    }

    // Mark slot as unavailable
    await supabaseAdmin
        .from('slots')
        .update({ is_available: false })
        .eq('id', slotId);

    res.status(201).json({
        message: 'Appointment created successfully',
        appointment
    });
};

/**
 * Update appointment
 */
export const updateAppointment = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    delete updates.patient_id;
    delete updates.token;

    const { data, error } = await supabaseAdmin
        .from('appointments')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new AppError('Failed to update appointment', 500);
    }

    res.status(200).json({
        message: 'Appointment updated successfully',
        appointment: data
    });
};

/**
 * Cancel appointment
 */
export const cancelAppointment = async (req, res) => {
    const { id } = req.params;

    // Get appointment details
    const { data: appointment, error: fetchError } = await supabaseAdmin
        .from('appointments')
        .select('slot_id, status')
        .eq('id', id)
        .single();

    if (fetchError || !appointment) {
        throw new AppError('Appointment not found', 404);
    }

    // Update appointment status
    const { error: updateError } = await supabaseAdmin
        .from('appointments')
        .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (updateError) {
        throw new AppError('Failed to cancel appointment', 500);
    }

    // Make slot available again
    if (appointment.slot_id) {
        await supabaseAdmin
            .from('slots')
            .update({ is_available: true })
            .eq('id', appointment.slot_id);
    }

    res.status(200).json({
        message: 'Appointment cancelled successfully'
    });
};

/**
 * Get appointments for a patient
 */
export const getPatientAppointments = async (req, res) => {
    const { patientId } = req.params;
    const { status, upcoming = 'false' } = req.query;

    let query = supabaseAdmin
        .from('appointments')
        .select(`
      *,
      doctor:doctors(id, name, specialty),
      department:departments(id, name)
    `)
        .eq('patient_id', patientId)
        .order('date', { ascending: false })
        .order('time', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    if (upcoming === 'true') {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('date', today).in('status', ['scheduled', 'confirmed']);
    }

    const { data, error } = await query;

    if (error) {
        throw new AppError('Failed to fetch patient appointments', 500);
    }

    res.status(200).json({ appointments: data });
};

/**
 * Get appointments for a doctor
 */
export const getDoctorAppointments = async (req, res) => {
    const { doctorId } = req.params;
    const { date, status } = req.query;

    let query = supabaseAdmin
        .from('appointments')
        .select(`
      *,
      patient:users!patient_id(id, name, email, phone),
      department:departments(id, name)
    `)
        .eq('doctor_id', doctorId)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

    if (date) {
        query = query.eq('date', date);
    }

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        throw new AppError('Failed to fetch doctor appointments', 500);
    }

    res.status(200).json({ appointments: data });
};
