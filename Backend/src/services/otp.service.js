import crypto from 'crypto';
import { OtpVerification, User } from '../models/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendOTPEmail } from './email.service.js';

const OTP_DEV_MODE = process.env.OTP_DEV_MODE === 'true';

function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

function hashOTP(identifier, code) {
    const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new AppError('OTP hashing secret is not configured', 500);
    }

    return crypto
        .createHmac('sha256', secret)
        .update(`${identifier}:${code}`)
        .digest('hex');
}

function normalizeIdentifier(identifier) {
    return String(identifier || '').toLowerCase().trim();
}

async function createOrGetUser(email) {
    let user = await User.findOne({ email }).lean();

    if (!user) {
        const created = await User.create({
            email,
            role: 'patient',
            is_active: true,
            auth_provider: 'otp',
        });
        user = created.toObject();
    }

    return user;
}

export async function sendOTP(email, name = 'User') {
    const normalizedEmail = normalizeIdentifier(email);
    if (!normalizedEmail) {
        throw new AppError('Email is required', 400);
    }

    const code = generateOTP();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await OtpVerification.create({
        identifier: normalizedEmail,
        code_hash: hashOTP(normalizedEmail, code),
        expires_at: expiresAt,
        verified: false,
        attempts: 0,
        max_attempts: 5,
    });

    if (!OTP_DEV_MODE) {
        if (!process.env.RESEND_API_KEY) {
            throw new AppError('Email service is not configured', 500);
        }
        await sendOTPEmail(normalizedEmail, code, name);
    } else {
        console.log('='.repeat(60));
        console.log('DEVELOPMENT MODE - OTP Generated');
        console.log('='.repeat(60));
        console.log(`Email: ${normalizedEmail}`);
        console.log(`OTP Code: ${code}`);
        console.log(`Expires: ${expiresAt.toISOString()}`);
        console.log('='.repeat(60));
    }

    return {
        success: true,
        message: OTP_DEV_MODE
            ? 'OTP generated successfully (Development Mode)'
            : 'OTP sent successfully. Please check your email.',
        expiresAt: expiresAt.toISOString(),
        devMode: OTP_DEV_MODE,
        ...(OTP_DEV_MODE && { code }),
    };
}

export async function verifyOTP(email, code) {
    const normalizedEmail = normalizeIdentifier(email);
    const normalizedCode = String(code || '').trim();

    if (!normalizedEmail || !normalizedCode) {
        return { success: false, message: 'Email and OTP code are required' };
    }

    const record = await OtpVerification.findOne({
        identifier: normalizedEmail,
        verified: false,
    })
        .select('+code_hash')
        .sort({ created_at: -1 });

    if (!record) {
        return {
            success: false,
            message: 'No active OTP found. Please request a new one.',
        };
    }

    if (record.expires_at < new Date()) {
        return {
            success: false,
            message: 'OTP has expired. Please request a new one.',
        };
    }

    if (record.attempts >= record.max_attempts) {
        return {
            success: false,
            message: 'Maximum attempts exceeded. Please request a new OTP.',
        };
    }

    record.attempts += 1;
    await record.save();

    if (record.code_hash !== hashOTP(normalizedEmail, normalizedCode)) {
        const remaining = Math.max(record.max_attempts - record.attempts, 0);
        return {
            success: false,
            message: `Incorrect OTP. ${remaining} attempt(s) remaining.`,
            remainingAttempts: remaining,
        };
    }

    record.verified = true;
    record.verified_at = new Date();
    await record.save();

    const user = await createOrGetUser(normalizedEmail);
    await User.findByIdAndUpdate(user._id, { last_login_at: new Date() });

    return {
        success: true,
        message: 'OTP verified successfully',
        user,
    };
}
