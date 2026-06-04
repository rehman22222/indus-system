import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Get all patients
 */
export const getAllPatients = async (req, res) => {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
        .from('users')
        .select('*', { count: 'exact' })
        .eq('role', 'patient')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
        throw new AppError('Failed to fetch patients', 500);
    }

    res.status(200).json({
        patients: data,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
        }
    });
};

/**
 * Get patient by ID
 */
export const getPatientById = async (req, res) => {
    const { id } = req.params;

    // Check if user has permission
    if (req.userRole === 'patient' && req.user.id !== id) {
        throw new AppError('Unauthorized to view this patient', 403);
    }

    const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', id)
        .eq('role', 'patient')
        .single();

    if (error || !data) {
        throw new AppError('Patient not found', 404);
    }

    res.status(200).json({ patient: data });
};

/**
 * Update patient information
 */
export const updatePatient = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Check if user has permission
    if (req.userRole === 'patient' && req.user.id !== id) {
        throw new AppError('Unauthorized to update this patient', 403);
    }

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.created_at;
    delete updates.role;

    const { data, error } = await supabaseAdmin
        .from('users')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('role', 'patient')
        .select()
        .single();

    if (error) {
        throw new AppError('Failed to update patient', 500);
    }

    res.status(200).json({
        message: 'Patient updated successfully',
        patient: data
    });
};
