import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { sendNotification, sendBulkNotification } from '../controllers/notification.controller.js';

const router = express.Router();

/**
 * POST /api/v1/notifications/send
 * Send push notification to a user
 */
router.post(
    '/send',
    authMiddleware,
    requireRole(['admin', 'doctor', 'management']),
    [
        body('userId')
            .notEmpty()
            .withMessage('User ID is required'),
        body('title')
            .notEmpty()
            .withMessage('Title is required'),
        body('body')
            .notEmpty()
            .withMessage('Body is required'),
        body('data')
            .optional()
            .isObject()
            .withMessage('Data must be an object'),
        validate
    ],
    asyncHandler(sendNotification)
);

/**
 * POST /api/v1/notifications/send-bulk
 * Send push notification to multiple users
 */
router.post(
    '/send-bulk',
    authMiddleware,
    requireRole(['admin', 'management']),
    [
        body('userIds')
            .isArray({ min: 1 })
            .withMessage('User IDs array is required'),
        body('title')
            .notEmpty()
            .withMessage('Title is required'),
        body('body')
            .notEmpty()
            .withMessage('Body is required'),
        body('data')
            .optional()
            .isObject()
            .withMessage('Data must be an object'),
        validate
    ],
    asyncHandler(sendBulkNotification)
);

export default router;
