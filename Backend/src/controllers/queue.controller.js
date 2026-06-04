import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Get current queue
 */
export const getQueue = async (req, res) => {
    const { departmentId, doctorId, status = 'waiting' } = req.query;

    let query = supabaseAdmin
        .from('queue')
        .select(`
      *,
      appointment:appointments(
        *,
        patient:users!patient_id(id, name, email, phone),
        doctor:doctors(id, name, specialty),
        department:departments(id, name)
      )
    `)
        .order('position', { ascending: true });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        throw new AppError('Failed to fetch queue', 500);
    }

    // Filter by department or doctor if specified
    let filteredData = data;
    if (departmentId) {
        filteredData = data.filter(q => q.appointment?.department_id === departmentId);
    }
    if (doctorId) {
        filteredData = data.filter(q => q.appointment?.doctor_id === doctorId);
    }

    res.status(200).json({ queue: filteredData });
};

/**
 * Get queue position for an appointment
 */
export const getQueuePosition = async (req, res) => {
    const { appointmentId } = req.params;

    const { data, error } = await supabaseAdmin
        .from('queue')
        .select(`
      *,
      appointment:appointments(
        *,
        doctor:doctors(id, name),
        department:departments(id, name)
      )
    `)
        .eq('appointment_id', appointmentId)
        .single();

    if (error || !data) {
        throw new AppError('Queue entry not found', 404);
    }

    res.status(200).json({ queueEntry: data });
};

/**
 * Update queue status
 */
export const updateQueueStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['waiting', 'called', 'in-progress', 'completed', 'no-show'];
    if (!validStatuses.includes(status)) {
        throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const updates = {
        status,
        updated_at: new Date().toISOString()
    };

    if (status === 'called') {
        updates.called_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
        .from('queue')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new AppError('Failed to update queue status', 500);
    }

    res.status(200).json({
        message: 'Queue status updated successfully',
        queueEntry: data
    });
};
