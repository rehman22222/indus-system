import { useCallback } from 'react';

/**
 * Custom email-OTP layer.
 *
 * Email verification is handled by the Node.js backend API
 * at `/api/auth/send-otp` and `/api/auth/verify-otp`
 * backed by the `otp_verifications` table.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export interface SendOtpResult {
  success: boolean;
  error?: string;
  /** Only present when the function runs in OTP_DEV_MODE — the 6-digit
   *  code generated server-side, returned directly so a developer can
   *  test the full flow without needing real email delivery. */
  devOtp?: string;
  /** True when the function ran in OTP_DEV_MODE (no email sent). */
  devMode?: boolean;
}

export interface VerifyOtpResult {
  success: boolean;
  verified?: boolean;
  error?: string;
  remainingAttempts?: number;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
  remainingAttempts?: number;
}

export function useOTP() {
  const sendOTP = useCallback(
    async (email: string, name?: string): Promise<SendOtpResult> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            name: name ?? '',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: data.message || data.error || 'Could not send the verification code. Please try again.',
          };
        }

        if (data.success) {
          return {
            success: true,
            devMode: process.env.NODE_ENV === 'development',
            devOtp: data.code, // Only available in development mode
          };
        }

        return {
          success: false,
          error: data.error || 'Could not send the verification code.',
        };
      } catch (error) {
        console.error('Send OTP error:', error);
        return {
          success: false,
          error: 'Network error. Please check your connection and try again.',
        };
      }
    },
    [],
  );

  const verifyOTP = useCallback(
    async (email: string, otp: string): Promise<VerifyOtpResult> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            code: otp.trim(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: data.message || data.error || 'Could not verify the code.',
            remainingAttempts: data.remainingAttempts,
          };
        }

        if (data.success) {
          // Store the JWT token and user info
          if (data.token) {
            localStorage.setItem('auth_token', data.token);
          }
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }

          return { success: true, verified: true };
        }

        return {
          success: false,
          error: data.error || 'Invalid OTP',
          remainingAttempts: data.remainingAttempts,
        };
      } catch (error) {
        console.error('Verify OTP error:', error);
        return {
          success: false,
          error: 'Network error. Please check your connection and try again.',
        };
      }
    },
    [],
  );

  return { sendOTP, verifyOTP };
}
