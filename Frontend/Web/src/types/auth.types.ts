export type UserRole = 'patient' | 'doctor' | 'admin' | 'management';

export interface AuthUser {
    id: string;
    name: string | null;
    email: string;
    phone?: string | null;
    role: UserRole;
    is_active: boolean;
    avatar_url?: string | null;
}

export interface OtpSendResponse {
    success: boolean;
    message: string;
    code?: string; // Only in development mode
    devMode?: boolean;
    expiresAt?: string;
}

export interface OtpVerifyResponse {
    success: boolean;
    message: string;
    user: AuthUser | null;
    token?: string;
}
