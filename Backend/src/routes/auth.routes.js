import express from 'express';
import { sendOTP, verifyOTP } from '../services/otp.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { User } from '../models/index.js';
import { serialize } from '../utils/mongo.js';
import { hashPassword, verifyPassword } from '../services/password.service.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const router = express.Router();

function signAuthToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            userId: user.id,
            email: user.email,
            role: user.role,
        },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN },
    );
}

/**
 * POST /api/auth/login
 * MongoDB-backed email/password login.
 */
router.post('/login', async (req, res, next) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!email || !password) {
            throw new AppError('Email and password are required', 400);
        }

        const userDoc = await User.findOne({ email }).select('+password_hash');
        if (!userDoc || !userDoc.is_active) {
            throw new AppError('Invalid email or password', 401);
        }

        const validPassword = await verifyPassword(password, userDoc.password_hash);
        if (!validPassword) {
            throw new AppError('Invalid email or password', 401);
        }

        userDoc.last_login_at = new Date();
        await userDoc.save();

        const user = serialize(userDoc);
        delete user.password_hash;

        res.status(200).json({
            success: true,
            message: 'Login successful',
            user,
            token: signAuthToken(user),
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/auth/send-otp
 * Send OTP to user's email using MongoDB-backed OTP storage.
 */
router.post('/send-otp', async (req, res, next) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new AppError('Valid email is required', 400);
        }

        const result = await sendOTP(email, req.body.name);

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
        const { email, code, password, name, phone, cnic, age, gender } = req.body;

        // Validate inputs
        if (!email || !code) {
            throw new AppError('Email and OTP code are required', 400);
        }

        const result = await verifyOTP(email, code);

        if (!result.success) {
            return res.status(400).json(result);
        }

        let userDoc = result.user;
        const updates = {};

        if (password) {
            if (String(password).length < 8) {
                throw new AppError('Password must be at least 8 characters', 400);
            }
            updates.password_hash = await hashPassword(password);
            updates.auth_provider = 'password';
        }
        if (name) updates.name = String(name).trim();
        if (phone) updates.phone = String(phone).trim();
        if (cnic) updates.medical_history = { ...(userDoc.medical_history || {}), cnic: String(cnic).trim() };
        if (age) updates.medical_history = { ...(updates.medical_history || userDoc.medical_history || {}), age: Number(age) };
        if (gender) updates.gender = String(gender).trim().toLowerCase();

        if (Object.keys(updates).length > 0) {
            userDoc = await User.findByIdAndUpdate(userDoc._id, updates, {
                new: true,
                runValidators: true,
            });
        }

        const user = serialize(userDoc);
        delete user.password_hash;

        res.status(200).json({
            success: true,
            message: result.message,
            user,
            token: signAuthToken(user),
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

        const result = await sendOTP(email, req.body.name);

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
