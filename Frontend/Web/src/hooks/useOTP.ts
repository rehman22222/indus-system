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

interface VerifyOtpPayload {
  password?: string;
  name?: string;
  phone?: string;
  cnic?: string;
  age?: number;
  gender?: string;
  purpose?: 'signup' | 'password-reset';
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
            purpose: 'signup',
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
          return { success: true };
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
    async (
      email: string,
      otp: string,
      payload: VerifyOtpPayload = {},
      persistSession = true,
    ): Promise<VerifyOtpResult> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            code: otp.trim(),
            purpose: payload.purpose || 'signup',
            ...payload,
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
          if (persistSession && data.token) {
            localStorage.setItem('auth_token', data.token);
          }
          if (persistSession && data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
          if (persistSession && data.token && data.user) {
            window.dispatchEvent(new Event('mongo-auth-change'));
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
