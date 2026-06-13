import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import {
    createVideoRoom,
    declineVideoCall,
    getVideoContext,
    getVideoDocument,
    saveVideoPrescription,
} from '../controllers/video.controller.js';

const router = express.Router();

/**
 * POST /api/v1/video/create-room
 * Create private appointment-scoped video consultation access
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

/**
 * POST /api/v1/video/decline
 * Patient declines an incoming video call (optionally with a reason).
 */
router.post(
    '/decline',
    authMiddleware,
    [
        body().custom((_, { req }) => {
            if (!req.body.appointmentId && !req.body.appointment_id) {
                throw new Error('Appointment ID is required');
            }
            return true;
        }),
        validate,
    ],
    asyncHandler(declineVideoCall)
);

// These endpoints use the short-lived signed video-call token instead of the
// normal portal session, because mobile Safari opens the consultation directly.
router.get('/context', asyncHandler(getVideoContext));
router.get('/documents/:id', asyncHandler(getVideoDocument));
router.put('/prescription', asyncHandler(saveVideoPrescription));

export default router;
