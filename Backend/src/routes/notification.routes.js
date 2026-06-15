import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
    createNotification,
    listNotifications,
    registerDeviceToken,
    sendNotification,
    sendBulkNotification,
    sendTestNotification,
    updateNotification,
} from '../controllers/notification.controller.js';

const router = express.Router();

router.get('/', authMiddleware, asyncHandler(listNotifications));
router.post(
    '/',
    authMiddleware,
    requireRole(['admin', 'doctor', 'management']),
    asyncHandler(createNotification),
);
router.patch('/:id', authMiddleware, asyncHandler(updateNotification));

// Self-test: any authenticated user can push a test notification to their own
// device to confirm FCM is delivering (used to verify the APK end-to-end).
router.post('/test', authMiddleware, asyncHandler(sendTestNotification));

router.post(
    '/register-device',
    authMiddleware,
    [
        body('token')
            .notEmpty()
            .withMessage('Device token is required'),
        body('provider')
            .optional()
            .isIn(['fcm', 'apns', 'expo', 'unknown'])
            .withMessage('Provider must be fcm, apns, expo, or unknown'),
        body('platform')
            .optional()
            .isIn(['android', 'ios', 'web', 'unknown'])
            .withMessage('Platform must be android, ios, web, or unknown'),
        validate,
    ],
    asyncHandler(registerDeviceToken),
);

/**
 * POST /api/v1/notifications/send
 * Send push notification to a user
 */
router.post(
    '/send',
    authMiddleware,
    requireRole(['admin', 'doctor', 'management']),
    [
        body().custom((_, { req }) => {
            if (!req.body.userId && !req.body.user_id) throw new Error('User ID is required');
            return true;
        }),
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
        body().custom((_, { req }) => {
            const ids = req.body.userIds || req.body.user_ids;
            if (!Array.isArray(ids) || ids.length === 0) {
                throw new Error('User IDs array is required');
            }
            return true;
        }),
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
