import jwt from 'jsonwebtoken';
import { sendOTP as sendOtpService, verifyOTP as verifyOtpService } from '../services/otp.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { serialize } from '../utils/mongo.js';

export const sendOTP = async (req, res) => {
    const { identifier, name } = req.body;
    const result = await sendOtpService(identifier, name);

    res.status(200).json({
        message: result.message,
        expiresAt: result.expiresAt,
        devMode: result.devMode,
        ...(result.code && { code: result.code }),
    });
};

export const verifyOTP = async (req, res) => {
    const { identifier, code } = req.body;
    const result = await verifyOtpService(identifier, code);

    if (!result.success) {
        throw new AppError(result.message || 'Invalid or expired OTP', 400);
    }

    if (!process.env.JWT_SECRET) {
        throw new AppError('JWT_SECRET is not configured', 500);
    }

    const user = serialize(result.user);
    const token = jwt.sign(
        {
            sub: user.id,
            userId: user.id,
            email: user.email,
            role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
    );

    res.status(200).json({
        message: 'OTP verified successfully',
        user,
        token,
    });
};
