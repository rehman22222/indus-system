import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import {
    getQueue,
    getQueuePosition,
    updateQueueStatus
} from '../controllers/queue.controller.js';

const router = express.Router();

/**
 * GET /api/v1/queue
 * Get current queue
 */
router.get(
    '/',
    authMiddleware,
    asyncHandler(getQueue)
);

/**
 * GET /api/v1/queue/position/:appointmentId
 * Get queue position for an appointment
 */
router.get(
    '/position/:appointmentId',
    authMiddleware,
    asyncHandler(getQueuePosition)
);

/**
 * PATCH /api/v1/queue/:id
 * Update queue status
 */
router.patch(
    '/:id',
    authMiddleware,
    asyncHandler(updateQueueStatus)
);

export default router;
