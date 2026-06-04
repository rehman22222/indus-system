// =================================================================
// In-memory authentication store
// =================================================================
//
// A session-scoped auth layer that sits ON TOP of the existing HMS.
// No localStorage / sessionStorage (sandbox blocks it) — everything
// lives in module scope and is wiped on full page reload, which is
// why the app always shows the Login page on launch (requirement #1).
//
// Roles map 1:1 to the existing dashboards / routes:
//   ADMIN      -> /admin
//   MANAGEMENT -> /management
//   DOCTOR     -> /doctor
//   PATIENT    -> /patient
//
// Pre-seeded demo credential (single account by request):
//   Admin@gmail.com / 123456  -> ADMIN   (email is case-insensitive)
//
// Patients self-register via the sign-up flow.

import { useSyncExternalStore } from 'react';
import type { UserRole } from '@/integrations/supabase/types';

// Admin can create accounts for roles beyond the four portal roles.
// RECEPTIONIST has no dedicated dashboard, so it lands on the check-in
// kiosk (the front-desk tool).
export type StaffRole = UserRole | 'RECEPTIONIST';

export interface AuthUser {
    email: string;
    role: StaffRole;
    fullName: string;
}

interface StoredAccount extends AuthUser {
    password: string;
}

export interface PendingRegistration {
    firstName: string;
    lastName: string;
    cnic: string;
    email: string;
    phone: string;
    password: string;
    age: number;
    gender: 'Male' | 'Female' | 'Other';
    otp: string;
}

// Role -> route the user lands on after a successful login.
export const ROLE_ROUTE: Record<StaffRole, string> = {
    ADMIN: '/admin',
    MANAGEMENT: '/management',
    DOCTOR: '/doctor',
    PATIENT: '/patient',
    RECEPTIONIST: '/check-in',
};

// --- mutable module state ---

// Email stored lowercase: login() normalizes input via
// .trim().toLowerCase(), so "Admin@gmail.com" still matches.
const accounts: StoredAccount[] = [
    { email: 'admin@gmail.com', password: '123456', role: 'ADMIN', fullName: 'Admin' },
];

let currentUser: AuthUser | null = null;
let pendingRegistration: PendingRegistration | null = null;

// --- observable plumbing (useSyncExternalStore contract) ---

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
    for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

// useSyncExternalStore requires a stable snapshot reference. currentUser
// is itself the snapshot — it only changes identity on login/logout.
function getCurrentUserSnapshot(): AuthUser | null {
    return currentUser;
}

// --- helpers ---

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// --- public API ---

export const authStore = {
    subscribe,
    getCurrentUser: getCurrentUserSnapshot,

    /**
     * Attempt a login. Returns the matched user, or an error string.
     * Role is derived purely from the matched credential.
     */
    login(email: string, password: string): { user: AuthUser } | { error: string } {
        const acct = accounts.find((a) => a.email === normalizeEmail(email));
        if (!acct || acct.password !== password) {
            return { error: 'Invalid email or password.' };
        }
        currentUser = { email: acct.email, role: acct.role, fullName: acct.fullName };
        emit();
        return { user: currentUser };
    },

    logout(): void {
        currentUser = null;
        pendingRegistration = null;
        emit();
    },

    /**
     * Begin a patient registration. Validates uniqueness, stores the
     * pending record with a freshly generated OTP, and returns the OTP
     * so the caller can surface it in a dev toast.
     */
    startRegistration(
        data: Omit<PendingRegistration, 'otp'>,
    ): { otp: string } | { error: string } {
        const email = normalizeEmail(data.email);
        if (accounts.some((a) => a.email === email)) {
            return { error: 'An account with this email already exists.' };
        }
        const otp = generateOtp();
        pendingRegistration = { ...data, email, otp };
        return { otp };
    },

    getPendingEmail(): string | null {
        return pendingRegistration?.email ?? null;
    },

    // RN has no toast; the mobile OTP screen surfaces this inline for
    // testing (the web surfaces the same value via a dev toast).
    getPendingOtp(): string | null {
        return pendingRegistration?.otp ?? null;
    },

    /**
     * Verify the OTP for the pending registration. On success the new
     * patient account is created (so they can immediately log in) and
     * the pending record is cleared.
     */
    verifyOtp(otp: string): { ok: true } | { error: string } {
        if (!pendingRegistration) {
            return { error: 'No pending registration. Please sign up again.' };
        }
        if (otp !== pendingRegistration.otp) {
            return { error: 'Incorrect OTP. Please try again.' };
        }
        const p = pendingRegistration;
        accounts.push({
            email: p.email,
            password: p.password,
            role: 'PATIENT',
            fullName: `${p.firstName} ${p.lastName}`.trim(),
        });
        pendingRegistration = null;
        return { ok: true };
    },

    /** Re-generate and return a fresh OTP for the pending registration. */
    resendOtp(): { otp: string } | { error: string } {
        if (!pendingRegistration) {
            return { error: 'No pending registration.' };
        }
        pendingRegistration = { ...pendingRegistration, otp: generateOtp() };
        return { otp: pendingRegistration.otp };
    },

    /**
     * Admin-only: create a staff login (Doctor / Management / Admin /
     * Receptionist). Idempotent on email — re-creating updates the
     * password/role/name. Called from the staff-creation flow so the
     * new account can immediately log in via the unified login page,
     * regardless of Supabase connectivity.
     */
    addStaffAccount(
        email: string,
        password: string,
        role: Exclude<StaffRole, 'PATIENT'>,
        fullName: string,
    ): { ok: true } | { error: string } {
        const normalized = normalizeEmail(email);
        if (!normalized || !password) {
            return { error: 'Email and password are required.' };
        }
        const existing = accounts.find((a) => a.email === normalized);
        if (existing) {
            existing.password = password;
            existing.role = role;
            existing.fullName = fullName;
        } else {
            accounts.push({ email: normalized, password, role, fullName });
        }
        return { ok: true };
    },

    /**
     * Patient-only: mirror a Supabase-Auth-verified patient into the
     * in-memory registry so the existing session/routing keeps working.
     * Real email verification / password is owned by Supabase Auth.
     * Idempotent on email.
     */
    syncPatientAccount(
        email: string,
        password: string,
        fullName: string,
    ): { ok: true } | { error: string } {
        const normalized = normalizeEmail(email);
        if (!normalized || !password) {
            return { error: 'Email and password are required.' };
        }
        const existing = accounts.find((a) => a.email === normalized);
        if (existing) {
            existing.password = password;
            existing.role = 'PATIENT';
            existing.fullName = fullName || existing.fullName;
        } else {
            accounts.push({
                email: normalized,
                password,
                role: 'PATIENT',
                fullName: fullName || normalized,
            });
        }
        return { ok: true };
    },
};

// --- React binding ---

export function useAuthSession(): AuthUser | null {
    return useSyncExternalStore(
        authStore.subscribe,
        authStore.getCurrentUser,
        authStore.getCurrentUser,
    );
}
