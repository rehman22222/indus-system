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
        body().custom((_, { req }) => {
            if (!req.body.appointmentId && !req.body.appointment_id) {
                throw new Error('Appointment ID is required');
            }
            return true;
        }),
        validate
    ],
    asyncHandler(createVideoRoom)
);

export default router;
