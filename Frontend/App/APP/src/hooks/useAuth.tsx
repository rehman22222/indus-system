import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/integrations/supabase/types';
import { authStore, useAuthSession } from '@/auth/authStore';

// AppRole is the same union as UserRole; kept exported for legacy callers.
export type AppRole = UserRole;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  /**
   * The user's role(s). The DB stores a single role on `public.users.role`,
   * but this is exposed as an array to preserve the existing call sites
   * (e.g. `roles.includes('ADMIN')`).
   */
  roles: AppRole[];
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string, phone?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isStaff: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer to avoid auth-state-change deadlock
          setTimeout(() => fetchUserRole(session.user.id), 0);
        } else {
          setRoles([]);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      const role = (data?.role ?? null) as AppRole | null;
      setRoles(role ? [role] : []);
    } catch (err) {
      console.error('[useAuth] Failed to fetch role:', err);
      setRoles([]);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      // React Native has no `window`; only build a web origin when it exists
      // (email confirmations are disabled, so this redirect is best-effort).
      const redirectUrl =
        typeof window !== 'undefined' && window.location
          ? `${window.location.origin}/`
          : undefined;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            phone: phone ?? null,
            // The DB trigger reads this and inserts public.users.role.
            // Defaults to 'PATIENT' when missing.
            role: 'PATIENT',
          },
        },
      });
      return { error: (error as Error) ?? null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: (error as Error) ?? null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    // Clear the in-memory auth wrapper too so the LoginScreen is shown.
    authStore.logout();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
  };

  // --- in-memory auth bridge -------------------------------------
  // The mobile LoginScreen authenticates against the in-memory
  // authStore (offline-capable, seeded demo credentials). When it has
  // a user, surface a synthetic Supabase `user` + `roles` so every
  // dashboard (which reads useAuth().user / roles) renders with the
  // logged-in identity. Falls back to the Supabase state untouched
  // when there is no in-memory session.
  const sessionUser = useAuthSession();

  const effectiveUser: User | null = sessionUser
    ? ({ id: sessionUser.email, email: sessionUser.email } as unknown as User)
    : user;

  const effectiveRoles: AppRole[] = sessionUser
    ? ([sessionUser.role].filter((r) => r !== 'RECEPTIONIST') as AppRole[])
    : roles;

  const hasRole = (role: AppRole) => effectiveRoles.includes(role);

  const isStaff = () => effectiveRoles.some((r) => r === 'ADMIN' || r === 'DOCTOR' || r === 'MANAGEMENT');

  return (
    <AuthContext.Provider value={{
      user: effectiveUser,
      session,
      roles: effectiveRoles,
      isLoading: sessionUser ? false : isLoading,
      signUp,
      signIn,
      signOut,
      hasRole,
      isStaff,
    }}>
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
