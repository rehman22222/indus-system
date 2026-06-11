import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
    getAllAppointments,
    getAppointmentById,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    getPatientAppointments,
    getDoctorAppointments
} from '../controllers/appointment.controller.js';

const router = express.Router();

/**
 * GET /api/v1/appointments
 * Get all appointments (admin/management only)
 */
router.get(
    '/',
    authMiddleware,
    asyncHandler(getAllAppointments)
);

/**
 * POST /api/v1/appointments
 * Create new appointment
 */
router.post(
    '/',
    authMiddleware,
    [
        body().custom((_, { req }) => {
            if (!req.body.patientId && !req.body.patient_id) throw new Error('Patient ID is required');
            if (!req.body.doctorId && !req.body.doctor_id) throw new Error('Doctor ID is required');
            if (!req.body.date && !req.body.appointment_date) throw new Error('Valid date is required');
            if (!req.body.time && !req.body.appointment_time) throw new Error('Time is required');
            return true;
        }),
        body('chiefComplaint').optional().isString(),
        body('chief_complaint').optional().isString(),
        validate
    ],
    asyncHandler(createAppointment)
);

/**
 * PATCH /api/v1/appointments/:id
 * Update appointment
 */
router.patch(
    '/:id',
    authMiddleware,
    asyncHandler(updateAppointment)
);

/**
 * DELETE /api/v1/appointments/:id
 * Cancel appointment
 */
router.delete(
    '/:id',
    authMiddleware,
    asyncHandler(cancelAppointment)
);

/**
 * GET /api/v1/appointments/patient/:patientId
 * Get appointments for a patient
 */
router.get(
    '/patient/:patientId',
    authMiddleware,
    asyncHandler(getPatientAppointments)
);

/**
 * GET /api/v1/appointments/doctor/:doctorId
 * Get appointments for a doctor
 */
router.get(
    '/doctor/:doctorId',
    authMiddleware,
    asyncHandler(getDoctorAppointments)
);

/**
 * GET /api/v1/appointments/:id
 * Get appointment by ID
 */
router.get(
    '/:id',
    authMiddleware,
    asyncHandler(getAppointmentById)
);

export default router;
