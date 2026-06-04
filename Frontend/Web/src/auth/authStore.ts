// =================================================================
// In-memory authentication store
// =================================================================
//
// An auth layer that sits ON TOP of the existing HMS.
//
// The ACCOUNT REGISTRY is persisted to localStorage so that staff
// accounts created at runtime by the Admin (doctors, management,
// receptionists) survive a full page reload — otherwise the doctor
// could be created but never log in, because the login page only
// checks this registry and a reload wiped it.
//
// The ACTIVE SESSION is deliberately NOT persisted: currentUser lives
// only in module scope, so the app still always shows the Login page
// on a fresh launch (requirement #1).
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
// Patients self-register via the sign-up + OTP flow. Doctors and
// Management accounts are created at runtime by the Admin via
// addStaffAccount().

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

// --- account registry persistence ---

const STORAGE_KEY = 'hms.auth.accounts.v1';

// Email stored lowercase: login() normalizes input via
// .trim().toLowerCase(), so users can type "Admin@gmail.com" and still
// match this entry. This pre-seeded admin is always guaranteed present,
// even if persisted data is missing or corrupt.
const SEED_ACCOUNT: StoredAccount = {
    email: 'admin@gmail.com',
    password: '123456',
    role: 'ADMIN',
    fullName: 'Admin',
};

function safeStorage(): Storage | null {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        // Touch it to surface private-mode / disabled-storage exceptions.
        const probe = '__hms_probe__';
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        return window.localStorage;
    } catch {
        return null;
    }
}

function isStoredAccount(v: unknown): v is StoredAccount {
    if (!v || typeof v !== 'object') return false;
    const a = v as Record<string, unknown>;
    return (
        typeof a.email === 'string' &&
        typeof a.password === 'string' &&
        typeof a.role === 'string' &&
        typeof a.fullName === 'string'
    );
}

function loadAccounts(): StoredAccount[] {
    const store = safeStorage();
    if (!store) return [{ ...SEED_ACCOUNT }];
    try {
        const raw = store.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const list: StoredAccount[] = Array.isArray(parsed)
            ? parsed.filter(isStoredAccount)
            : [];
        // Guarantee the demo admin always exists and is never shadowed.
        if (!list.some((a) => a.email === SEED_ACCOUNT.email)) {
            list.unshift({ ...SEED_ACCOUNT });
        }
        return list.length ? list : [{ ...SEED_ACCOUNT }];
    } catch {
        return [{ ...SEED_ACCOUNT }];
    }
}

function persistAccounts(): void {
    const store = safeStorage();
    if (!store) return;
    try {
        store.setItem(STORAGE_KEY, JSON.stringify(accounts));
    } catch {
        /* storage full / unavailable — registry stays in-memory only */
    }
}

// --- mutable module state ---

// Hydrated from localStorage on module load so runtime-created staff
// accounts survive page reloads.
const accounts: StoredAccount[] = loadAccounts();

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
        persistAccounts();
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
        persistAccounts();
        return { ok: true };
    },

    /**
     * Patient-only: mirror a Supabase-Auth-verified patient into the
     * in-memory registry so the unified login page + AuthGate routing
     * (and the email-keyed data hooks) keep working unchanged. Real
     * email verification / password is owned by Supabase Auth; this is
     * just the local session/routing shadow. Idempotent on email.
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
        persistAccounts();
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
