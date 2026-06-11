import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@/integrations/mongodb/client';
import type { UserRole } from '@/integrations/mongodb/types';
import { authStore, useAuthSession } from '@/auth/authStore';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

export type AppRole = UserRole;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isStaff: () => boolean;
}

type LoginResponse = {
  success: boolean;
  token: string;
  user: User & { role?: string; name?: string };
  message?: string;
  error?: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeRole(role?: string): AppRole {
  const value = String(role || 'patient').trim().toUpperCase();
  if (value === 'ADMIN' || value === 'DOCTOR' || value === 'MANAGEMENT' || value === 'PATIENT') {
    return value;
  }
  return 'PATIENT';
}

function getStoredSession(): { token: string; user: User & { role?: string } } | null {
  try {
    const token = localStorage.getItem('auth_token');
    const rawUser = localStorage.getItem('user');
    if (!token || !rawUser) return null;
    return { token, user: JSON.parse(rawUser) };
  } catch {
    return null;
  }
}

function persistSession(token: string, user: User) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
}

function makeSession(token: string, user: User): Session {
  return { access_token: token, user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const sessionUser = useAuthSession();

  useEffect(() => {
    const hydrate = () => {
      const stored = getStoredSession();
      if (stored) {
        setUser(stored.user);
        setSession(makeSession(stored.token, stored.user));
        setRoles([normalizeRole(stored.user.role)]);
      } else {
        setUser(null);
        setSession(null);
        setRoles([]);
      }
      setIsLoading(false);
    };

    hydrate();
    window.addEventListener('mongo-auth-change', hydrate);
    return () => window.removeEventListener('mongo-auth-change', hydrate);
  }, []);

  const signUp = async (email: string, _password: string, fullName: string, phone?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: fullName, phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        return { error: new Error(data.message || data.error || 'Could not start signup.') };
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok || !data.success || !data.token || !data.user) {
        return { error: new Error(data.message || data.error || 'Invalid email or password.') };
      }

      persistSession(data.token, data.user);
      setUser(data.user);
      setSession(makeSession(data.token, data.user));
      setRoles([normalizeRole(data.user.role)]);
      authStore.logout();

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    clearSession();
    authStore.logout();
    setUser(null);
    setSession(null);
    setRoles([]);
  };

  const effectiveUser: User | null = sessionUser
    ? { id: sessionUser.email, email: sessionUser.email, role: sessionUser.role }
    : user;

  const effectiveRoles: AppRole[] = sessionUser
    ? [normalizeRole(sessionUser.role)]
    : roles;

  const hasRole = (role: AppRole) => effectiveRoles.includes(role);
  const isStaff = () => effectiveRoles.some((role) => role === 'ADMIN' || role === 'DOCTOR' || role === 'MANAGEMENT');

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        session,
        roles: effectiveRoles,
        isLoading: sessionUser ? false : isLoading,
        signUp,
        signIn,
        signOut,
        hasRole,
        isStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
