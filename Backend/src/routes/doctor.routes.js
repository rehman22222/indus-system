import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
    getAllDoctors,
    getDoctorById,
    getDoctorsByDepartment,
    getDoctorSlots
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
 * GET /api/v1/doctors/:id
 * Get doctor by ID
 */
router.get(
    '/:id',
    asyncHandler(getDoctorById)
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
 * GET /api/v1/doctors/:id/slots
 * Get available slots for a doctor
 */
router.get(
    '/:id/slots',
    asyncHandler(getDoctorSlots)
);

export default router;
