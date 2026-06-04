import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

const OTP_DEV_MODE = process.env.OTP_DEV_MODE === 'true';

/**
 * Generate secure 6-digit OTP
 */
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

/**
 * Send OTP - Development Mode (No email required)
 * In dev mode, OTP is stored in database and returned in response
 */
export async function sendOTP(email) {
    try {
        const normalizedEmail = email.toLowerCase().trim();

        if (OTP_DEV_MODE) {
            // Development Mode - Store OTP in database, no email sent
            const code = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // Store in database
            const { data, error } = await supabaseAdmin
                .from('otp_verifications')
                .insert({
                    identifier: normalizedEmail,
                    code,
                    expires_at: expiresAt.toISOString(),
                    verified: false,
                    attempts: 0,
                    max_attempts: 5
                })
                .select()
                .single();

            if (error) {
                console.error('Error storing OTP:', error);
                throw new AppError('Failed to generate OTP', 500);
            }

            console.log('='.repeat(60));
            console.log('🔐 DEVELOPMENT MODE - OTP Generated');
            console.log('='.repeat(60));
            console.log(`📧 Email: ${normalizedEmail}`);
            console.log(`🔑 OTP Code: ${code}`);
            console.log(`⏰ Expires: ${expiresAt.toISOString()}`);
            console.log(`ℹ️  Use this code to login (valid for 10 minutes)`);
            console.log('='.repeat(60));

            return {
                success: true,
                message: 'OTP generated successfully (Development Mode)',
                code, // Return code in dev mode
                expiresAt: expiresAt.toISOString(),
                devMode: true
            };
        } else {
            // Production Mode - Use Supabase Auth
            const { data, error } = await supabaseAdmin.auth.signInWithOtp({
                email: normalizedEmail,
                options: {
                    shouldCreateUser: true,
                },
            });

            if (error) {
                console.error('Supabase Auth OTP error:', error);
                throw new AppError(error.message || 'Failed to send OTP', 500);
            }

            console.log(`✅ OTP sent via Supabase Auth to ${normalizedEmail}`);

            return {
                success: true,
                message: 'OTP sent successfully. Please check your email.',
            };
        }
    } catch (error) {
        console.error('Error in sendOTP:', error);
        throw error;
    }
}

/**
 * Verify OTP
 */
export async function verifyOTP(email, code) {
    try {
        const normalizedEmail = email.toLowerCase().trim();

        if (OTP_DEV_MODE) {
            // Development Mode - Verify from database
            const { data: record, error: findError } = await supabaseAdmin
                .from('otp_verifications')
                .select('*')
                .eq('identifier', normalizedEmail)
                .eq('verified', false)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (findError || !record) {
                return {
                    success: false,
                    message: 'No active OTP found. Please request a new one.'
                };
            }

            // Check if expired
            if (new Date(record.expires_at) < new Date()) {
                return {
                    success: false,
                    message: 'OTP has expired. Please request a new one.'
                };
            }

            // Check attempts
            if (record.attempts >= record.max_attempts) {
                return {
                    success: false,
                    message: 'Maximum attempts exceeded. Please request a new OTP.'
                };
            }

            // Increment attempts
            await supabaseAdmin
                .from('otp_verifications')
                .update({ attempts: record.attempts + 1 })
                .eq('id', record.id);

            // Verify code
            if (record.code !== code.trim()) {
                const remaining = record.max_attempts - record.attempts - 1;
                return {
                    success: false,
                    message: `Incorrect OTP. ${remaining} attempt(s) remaining.`
                };
            }

            // Mark as verified
            await supabaseAdmin
                .from('otp_verifications')
                .update({
                    verified: true,
                    verified_at: new Date().toISOString()
                })
                .eq('id', record.id);

            console.log(`✅ OTP verified (dev mode) for ${normalizedEmail}`);

            // Get or create user
            let { data: user } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('email', normalizedEmail)
                .single();

            if (!user) {
                const { data: newUser, error: createError } = await supabaseAdmin
                    .from('users')
                    .insert({
                        email: normalizedEmail,
                        role: 'patient',
                        is_active: true
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error('Error creating user:', createError);
                }
                user = newUser;
            }

            return {
                success: true,
                message: 'OTP verified successfully',
                user
            };
        } else {
            // Production Mode - Use Supabase Auth
            const { data, error } = await supabaseAdmin.auth.verifyOtp({
                email: normalizedEmail,
                token: code.trim(),
                type: 'email'
            });

            if (error) {
                return {
                    success: false,
                    message: error.message || 'Invalid or expired OTP code'
                };
            }

            if (!data.user) {
                return {
                    success: false,
                    message: 'Verification failed. Please try again.'
                };
            }

            // Get or create user in our table
            let { data: user } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('email', normalizedEmail)
                .single();

            if (!user) {
                const { data: newUser } = await supabaseAdmin
                    .from('users')
                    .insert({
                        id: data.user.id,
                        email: normalizedEmail,
                        role: 'patient',
                        is_active: true
                    })
                    .select()
                    .single();

                user = newUser || { id: data.user.id, email: normalizedEmail, role: 'patient' };
            }

            return {
                success: true,
                message: 'OTP verified successfully',
                user,
                session: data.session
            };
        }
    } catch (error) {
        console.error('Error in verifyOTP:', error);
        throw error;
    }
}
