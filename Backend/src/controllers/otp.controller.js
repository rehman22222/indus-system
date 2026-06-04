import { supabaseAdmin } from '../config/supabase.js';
import { sendOTPEmail } from '../services/email.service.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Generate 6-digit OTP
 */
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP to user
 */
export const sendOTP = async (req, res) => {
    const { identifier, type = 'email' } = req.body;

    // Generate OTP
    const code = generateOTP();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Store OTP in database
    const { data: otpData, error: otpError } = await supabaseAdmin
        .from('otp_verifications')
        .insert({
            identifier,
            code,
            expires_at: expiresAt.toISOString(),
            verified: false
        })
        .select()
        .single();

    if (otpError) {
        throw new AppError('Failed to generate OTP', 500);
    }

    // Send OTP via email
    if (type === 'email') {
        try {
            await sendOTPEmail(identifier, code);
        } catch (error) {
            console.error('Failed to send OTP email:', error);
            throw new AppError('Failed to send OTP email', 500);
        }
    }

    res.status(200).json({
        message: 'OTP sent successfully',
        expiresAt: expiresAt.toISOString(),
        // Only in development
        ...(process.env.NODE_ENV === 'development' && { code })
    });
};

/**
 * Verify OTP code
 */
export const verifyOTP = async (req, res) => {
    const { identifier, code } = req.body;

    // Find OTP record
    const { data: otpRecord, error: findError } = await supabaseAdmin
        .from('otp_verifications')
        .select('*')
        .eq('identifier', identifier)
        .eq('code', code)
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (findError || !otpRecord) {
        throw new AppError('Invalid or expired OTP', 400);
    }

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
        throw new AppError('OTP has expired', 400);
    }

    // Mark OTP as verified
    const { error: updateError } = await supabaseAdmin
        .from('otp_verifications')
        .update({ verified: true, verified_at: new Date().toISOString() })
        .eq('id', otpRecord.id);

    if (updateError) {
        throw new AppError('Failed to verify OTP', 500);
    }

    // Check if user exists
    let userId;
    const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .or(`email.eq.${identifier},phone.eq.${identifier}`)
        .single();

    if (existingUser) {
        userId = existingUser.id;
    } else {
        // Create new user if doesn't exist
        const isEmail = identifier.includes('@');
        const { data: newUser, error: createError } = await supabaseAdmin
            .from('users')
            .insert({
                [isEmail ? 'email' : 'phone']: identifier,
                role: 'patient'
            })
            .select('id')
            .single();

        if (createError) {
            throw new AppError('Failed to create user', 500);
        }

        userId = newUser.id;
    }

    // Create Supabase auth session
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: identifier.includes('@') ? identifier : `${identifier}@temp.com`,
        options: {
            data: {
                user_id: userId
            }
        }
    });

    if (authError) {
        throw new AppError('Failed to create session', 500);
    }

    res.status(200).json({
        message: 'OTP verified successfully',
        userId,
        session: authData
    });
};
