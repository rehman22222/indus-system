import type { OtpSendResponse, OtpVerifyResponse } from '../types/auth.types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export async function sendOtp(email: string, name?: string): Promise<OtpSendResponse> {
    const res = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: email.toLowerCase().trim(),
            name: name?.trim() || 'User',
        }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP');
    }

    return data;
}

export async function verifyOtp(email: string, code: string): Promise<OtpVerifyResponse> {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: email.toLowerCase().trim(),
            code: code.trim(),
        }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to verify OTP');
    }

    return data;
}
