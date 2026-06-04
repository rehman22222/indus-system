import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { createVideoRoom } from '../controllers/video.controller.js';

const router = express.Router();

/**
 * POST /api/v1/video/create-room
 * Create a Daily.co video room
 */
router.post(
    '/create-room',
    authMiddleware,
    [
        body('appointmentId')
            .notEmpty()
            .withMessage('Appointment ID is required'),
        body('patientId')
            .notEmpty()
            .withMessage('Patient ID is required'),
        body('doctorId')
            .notEmpty()
            .withMessage('Doctor ID is required'),
        validate
    ],
    asyncHandler(createVideoRoom)
);

export default router;
