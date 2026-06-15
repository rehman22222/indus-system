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

export async function sendOTP(email, name = 'User', purpose = 'signup') {
    const normalizedEmail = normalizeIdentifier(email);
    if (!normalizedEmail) {
        throw new AppError('Email is required', 400);
    }

    const code = generateOTP();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const purposeFilter = purpose === 'signup'
        ? { $or: [{ purpose }, { purpose: { $exists: false } }] }
        : { purpose };

    await OtpVerification.updateMany(
        { identifier: normalizedEmail, verified: false, ...purposeFilter },
        { $set: { verified: true, verified_at: new Date() } },
    );

    const verification = await OtpVerification.create({
        identifier: normalizedEmail,
        purpose,
        code_hash: hashOTP(normalizedEmail, code),
        expires_at: expiresAt,
        verified: false,
        attempts: 0,
        max_attempts: 5,
    });

    if (!OTP_DEV_MODE) {
        const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
        if (!process.env.RESEND_API_KEY && !hasSmtp) {
            await OtpVerification.deleteOne({ _id: verification._id });
            throw new AppError('Email service is not configured', 500);
        }
        try {
            await sendOTPEmail(normalizedEmail, code, name, purpose);
        } catch (error) {
            await OtpVerification.deleteOne({ _id: verification._id });
            const restrictedRecipient = Number(error?.statusCode) === 403
                && /only send testing emails/i.test(String(error?.message || ''));
            throw new AppError(
                restrictedRecipient
                    ? 'Email delivery is restricted by the current sender account. Configure SMTP or verify a sending domain.'
                    : 'Verification email could not be sent. Please try again.',
                502,
            );
        }
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
        message: purpose === 'password-reset'
            ? 'Password reset code sent. Please check your email.'
            : 'Verification code sent. Please check your email.',
        expiresAt: expiresAt.toISOString(),
    };
}

export async function verifyOTP(email, code, purpose = 'signup') {
    const normalizedEmail = normalizeIdentifier(email);
    const normalizedCode = String(code || '').trim();

    if (!normalizedEmail || !normalizedCode) {
        return { success: false, message: 'Email and OTP code are required' };
    }

    const record = await OtpVerification.findOne({
        identifier: normalizedEmail,
        $or: purpose === 'signup'
            ? [{ purpose }, { purpose: { $exists: false } }]
            : [{ purpose }],
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

    const storedHash = Buffer.from(record.code_hash, 'hex');
    const submittedHash = Buffer.from(hashOTP(normalizedEmail, normalizedCode), 'hex');
    const codeMatches = storedHash.length === submittedHash.length
        && crypto.timingSafeEqual(storedHash, submittedHash);

    if (!codeMatches) {
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

    const user = purpose === 'password-reset'
        ? await User.findOne({ email: normalizedEmail }).lean()
        : await createOrGetUser(normalizedEmail);
    if (!user) {
        return { success: false, message: 'Password reset request is invalid or expired.' };
    }
    await User.findByIdAndUpdate(user._id, { last_login_at: new Date() });

    return {
        success: true,
        message: 'OTP verified successfully',
        user,
    };
}
