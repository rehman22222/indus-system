import { apiRequest } from '@/api/client';
import type { AuthSession } from '@/api/types';

export async function login(email: string, password: string) {
  const result = await apiRequest<AuthSession & { success: boolean }>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  return {
    token: result.token,
    user: result.user,
  };
}

export async function sendPatientSignupOtp(email: string, name: string) {
  return apiRequest<{ success: boolean; expiresAt?: string; message?: string }>('/api/auth/send-otp', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim(), purpose: 'signup' }),
  });
}

export async function sendPatientPasswordResetOtp(email: string) {
  return apiRequest<{ success: boolean; expiresAt?: string; message?: string }>('/api/auth/send-otp', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'password-reset' }),
  });
}

export async function verifyPatientSignup(input: {
  email: string;
  code: string;
  password: string;
  name: string;
  phone?: string;
  cnic?: string;
  age?: number;
  gender?: string;
}) {
  const result = await apiRequest<AuthSession & { success: boolean }>('/api/auth/verify-otp', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      code: input.code.trim(),
      password: input.password,
      name: input.name.trim(),
      phone: input.phone?.trim(),
      cnic: input.cnic?.trim(),
      age: input.age,
      gender: input.gender,
      purpose: 'signup',
    }),
  });

  return { token: result.token, user: result.user };
}

export async function verifyPatientPasswordReset(input: {
  email: string;
  code: string;
  password: string;
}) {
  const result = await apiRequest<AuthSession & { success: boolean }>('/api/auth/verify-otp', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      code: input.code.trim(),
      password: input.password,
      purpose: 'password-reset',
    }),
  });

  return { token: result.token, user: result.user };
}
