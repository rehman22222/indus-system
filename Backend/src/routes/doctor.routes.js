import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
    createDoctor,
    getAllDoctors,
    getDoctorById,
    getDoctorsByDepartment,
    getDoctorSlots,
    updateDoctor,
} from '../controllers/doctor.controller.js';

const router = express.Router();

/**
 * GET /api/v1/doctors
 * Get all doctors
 */
router.get(
    '/',
    asyncHandler(getAllDoctors)
);

/**
 * POST /api/v1/doctors
 * Create doctor profile
 */
router.post(
    '/',
    authMiddleware,
    requireRole(['admin', 'management']),
    asyncHandler(createDoctor)
);

/**
 * GET /api/v1/doctors/department/:departmentId
 * Get doctors by department
 */
router.get(
    '/department/:departmentId',
    asyncHandler(getDoctorsByDepartment)
);

/**
 * GET /api/v1/doctors/:id
 * Get doctor by ID
 */
router.get(
    '/:id',
    asyncHandler(getDoctorById)
);

/**
 * PATCH /api/v1/doctors/:id
 * Update doctor profile
 */
router.patch(
    '/:id',
    authMiddleware,
    requireRole(['admin', 'management']),
    asyncHandler(updateDoctor)
);

/**
 * GET /api/v1/doctors/:id/slots
 * Get available slots for a doctor
 */
router.get(
    '/:id/slots',
    asyncHandler(getDoctorSlots)
);

export default router;
