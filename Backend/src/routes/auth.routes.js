import express from 'express';
import { sendOTP, verifyOTP } from '../services/otp.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

/**
 * POST /api/auth/send-otp
 * Send OTP to user's email using Supabase Auth
 */
router.post('/send-otp', async (req, res, next) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new AppError('Valid email is required', 400);
        }

        // Send OTP via Supabase Auth
        const result = await sendOTP(email);

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP and return user session
 */
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { email, code } = req.body;

        // Validate inputs
        if (!email || !code) {
            throw new AppError('Email and OTP code are required', 400);
        }

        // Verify OTP via Supabase Auth
        const result = await verifyOTP(email, code);

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Generate JWT token for our backend
        const token = jwt.sign(
            {
                userId: result.user.id,
                email: result.user.email,
                role: result.user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.status(200).json({
            success: true,
            message: result.message,
            user: result.user,
            token,
            supabaseSession: result.session // Include Supabase session for frontend
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/resend-otp
 * Resend OTP to user
 */
router.post('/resend-otp', async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            throw new AppError('Email is required', 400);
        }

        // Send OTP via Supabase Auth
        const result = await sendOTP(email);

        res.status(200).json({
            success: true,
            message: 'OTP resent successfully',
            ...result
        });
    } catch (error) {
        next(error);
    }
});

export default router;
