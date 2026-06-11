import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
    createPatient,
    getAllPatients,
    getPatientById,
    updatePatient
} from '../controllers/patient.controller.js';

const router = express.Router();

/**
 * GET /api/v1/patients
 * Get all patients (admin/management only)
 */
router.get(
    '/',
    authMiddleware,
    requireRole(['admin', 'management', 'doctor']),
    asyncHandler(getAllPatients)
);

/**
 * POST /api/v1/patients
 * Create patient profile
 */
router.post(
    '/',
    authMiddleware,
    requireRole(['admin', 'management']),
    asyncHandler(createPatient)
);

/**
 * GET /api/v1/patients/:id
 * Get patient by ID
 */
router.get(
    '/:id',
    authMiddleware,
    asyncHandler(getPatientById)
);

/**
 * PATCH /api/v1/patients/:id
 * Update patient information
 */
router.patch(
    '/:id',
    authMiddleware,
    asyncHandler(updatePatient)
);

export default router;
