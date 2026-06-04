import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validator.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendOTP, verifyOTP } from '../controllers/otp.controller.js';

const router = express.Router();

/**
 * POST /api/v1/otp/send
 * Send OTP to email or phone
 */
router.post(
    '/send',
    [
        body('identifier')
            .notEmpty()
            .withMessage('Email or phone is required'),
        body('type')
            .optional()
            .isIn(['email', 'sms'])
            .withMessage('Type must be email or sms'),
        validate
    ],
    asyncHandler(sendOTP)
);

/**
 * POST /api/v1/otp/verify
 * Verify OTP code
 */
router.post(
    '/verify',
    [
        body('identifier')
            .notEmpty()
            .withMessage('Email or phone is required'),
        body('code')
            .notEmpty()
            .withMessage('OTP code is required')
            .isLength({ min: 6, max: 6 })
            .withMessage('OTP must be 6 digits'),
        validate
    ],
    asyncHandler(verifyOTP)
);

export default router;
