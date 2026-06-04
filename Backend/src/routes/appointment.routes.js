import express from 'express';
import { body, query } from 'express-validator';
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
    requireRole(['admin', 'management']),
    asyncHandler(getAllAppointments)
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

/**
 * POST /api/v1/appointments
 * Create new appointment
 */
router.post(
    '/',
    authMiddleware,
    [
        body('patientId').notEmpty().withMessage('Patient ID is required'),
        body('doctorId').notEmpty().withMessage('Doctor ID is required'),
        body('departmentId').notEmpty().withMessage('Department ID is required'),
        body('slotId').notEmpty().withMessage('Slot ID is required'),
        body('date').notEmpty().isISO8601().withMessage('Valid date is required'),
        body('time').notEmpty().withMessage('Time is required'),
        body('chiefComplaint').optional().isString(),
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

export default router;
