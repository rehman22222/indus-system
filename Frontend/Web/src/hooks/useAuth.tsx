import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { UserRole } from '@/integrations/supabase/types';
import { authStore, useAuthSession } from '@/auth/authStore';
import { roleFromEmail } from '@/lib/roleFromEmail';

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
          setTimeout(() => resolveRole(session.user), 0);
        } else {
          setRoles([]);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        resolveRole(session.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Role resolution is driven by the email address first:
  //   admin<n>@indus.org.pk      → ADMIN
  //   doctor<n>@indus.org.pk     → DOCTOR
  //   management<n>@indus.org.pk → MANAGEMENT
  //   anything else              → PATIENT (default)
  //
  // This makes routing deterministic regardless of what was stored in
  // user_metadata (older accounts created before this rule still route
  // correctly on next login). user_metadata.role is still respected as
  // an escape hatch if you ever need a custom-email staff account.
  const resolveRole = async (u: User) => {
    const emailRole = roleFromEmail(u.email);
    if (emailRole) {
      setRoles([emailRole]);
      return;
    }
    const metaRole = (u.user_metadata as { role?: string } | undefined)?.role;
    if (metaRole === 'ADMIN' || metaRole === 'DOCTOR' || metaRole === 'MANAGEMENT') {
      setRoles([metaRole]);
      return;
    }
    // Custom emails always land in the patient portal.
    setRoles(['PATIENT']);
  };

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
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
    // Clear the in-memory auth wrapper too so the AuthGate returns to
    // the login screen.
    authStore.logout();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
  };

  // --- in-memory auth bridge -------------------------------------
  // The unified login wrapper (src/auth) is the real entry point.
  // When it has an authenticated user, surface a synthetic Supabase
  // `user` + `roles` so every existing dashboard (which gates on
  // useAuth().user / roles) renders without its own legacy auth
  // screen. When there is no in-memory user we fall back to the
  // original Supabase-driven state untouched.
  const sessionUser = useAuthSession();

  const effectiveUser: User | null = sessionUser
    ? ({ id: sessionUser.email, email: sessionUser.email } as unknown as User)
    : user;

  // sessionUser.role may be RECEPTIONIST, which is not a portal AppRole.
  // Receptionist has no role-gated dashboard (it lands on /check-in via
  // ROLE_ROUTE), so it simply contributes no portal role here.
  // Real Supabase patients have no public.users row, so fetchUserRole
  // returns []. Fall back to the role stamped into auth user_metadata
  // at signup (we set role: 'PATIENT').
  const metaRole = ((user?.user_metadata as { role?: string } | undefined)?.role) as
    | AppRole
    | undefined;

  const effectiveRoles: AppRole[] = sessionUser
    ? ([sessionUser.role].filter(
        (r): r is AppRole => r === 'ADMIN' || r === 'DOCTOR' || r === 'PATIENT' || r === 'MANAGEMENT',
      ))
    : (roles.length
        ? roles
        : (metaRole === 'ADMIN' || metaRole === 'DOCTOR' || metaRole === 'PATIENT' || metaRole === 'MANAGEMENT'
            ? [metaRole]
            : []));

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
