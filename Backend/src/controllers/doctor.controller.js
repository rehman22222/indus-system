import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Get all doctors
 */
export const getAllDoctors = async (req, res) => {
    const { specialty, departmentId, available = 'false' } = req.query;

    let query = supabaseAdmin
        .from('doctors')
        .select(`
      *,
      department:departments(id, name),
      user:users!user_id(id, email, name)
    `)
        .order('name', { ascending: true });

    if (specialty) {
        query = query.eq('specialty', specialty);
    }

    if (departmentId) {
        query = query.eq('department_id', departmentId);
    }

    const { data, error } = await query;

    if (error) {
        throw new AppError('Failed to fetch doctors', 500);
    }

    res.status(200).json({ doctors: data });
};

/**
 * Get doctor by ID
 */
export const getDoctorById = async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
        .from('doctors')
        .select(`
      *,
      department:departments(*),
      user:users!user_id(*)
    `)
        .eq('id', id)
        .single();

    if (error || !data) {
        throw new AppError('Doctor not found', 404);
    }

    res.status(200).json({ doctor: data });
};

/**
 * Get doctors by department
 */
export const getDoctorsByDepartment = async (req, res) => {
    const { departmentId } = req.params;

    const { data, error } = await supabaseAdmin
        .from('doctors')
        .select(`
      *,
      department:departments(id, name),
      user:users!user_id(id, email, name)
    `)
        .eq('department_id', departmentId)
        .order('name', { ascending: true });

    if (error) {
        throw new AppError('Failed to fetch doctors', 500);
    }

    res.status(200).json({ doctors: data });
};

/**
 * Get available slots for a doctor
 */
export const getDoctorSlots = async (req, res) => {
    const { id } = req.params;
    const { date, startDate, endDate } = req.query;

    let query = supabaseAdmin
        .from('slots')
        .select('*')
        .eq('doctor_id', id)
        .eq('is_available', true)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

    if (date) {
        query = query.eq('date', date);
    } else if (startDate && endDate) {
        query = query.gte('date', startDate).lte('date', endDate);
    } else {
        // Default to next 7 days
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        query = query
            .gte('date', today.toISOString().split('T')[0])
            .lte('date', nextWeek.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) {
        throw new AppError('Failed to fetch doctor slots', 500);
    }

    res.status(200).json({ slots: data });
};
