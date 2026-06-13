import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { login as loginRequest } from '@/api/auth';
import { setAccessToken } from '@/api/client';
import type { AuthSession, User } from '@/api/types';
import { clearSession, readSession, saveSession } from '@/auth/storage';
import { registerForPushNotifications } from '@/services/notifications';
import { disconnectRealtime } from '@/services/realtime';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isBooting: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isPatientRole(role?: string) {
  return String(role || '').trim().toLowerCase() === 'patient';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    let mounted = true;
    readSession()
      .then((raw) => {
        if (!mounted || !raw) return;
        const stored = JSON.parse(raw) as AuthSession;
        if (!isPatientRole(stored.user?.role)) {
          clearSession().catch(() => undefined);
          setAccessToken(null);
          return;
        }
        setAccessToken(stored.token);
        setSession(stored);
        registerForPushNotifications().catch((error) => {
          console.log('Push registration skipped:', error?.message || 'unavailable in Expo Go');
        });
      })
      .finally(() => {
        if (mounted) setIsBooting(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await loginRequest(email, password);
    if (!isPatientRole(nextSession.user?.role)) {
      setAccessToken(null);
      await clearSession();
      throw new Error('This mobile app is for patients only. Doctor, admin, and management users should use the web portal.');
    }
    setAccessToken(nextSession.token);
    setSession(nextSession);
    await saveSession(JSON.stringify(nextSession));
    registerForPushNotifications().catch((error) => {
      console.log('Push registration skipped:', error?.message || 'unavailable in Expo Go');
    });
  }, []);

  const signOut = useCallback(async () => {
    disconnectRealtime();
    setAccessToken(null);
    setSession(null);
    await clearSession();
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user || null,
      token: session?.token || null,
      isBooting,
      signIn,
      signOut,
    }),
    [isBooting, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
