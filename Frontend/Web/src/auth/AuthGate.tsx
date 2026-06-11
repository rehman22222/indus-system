import { useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthSession, ROLE_ROUTE } from './authStore';
import { useAuth } from '@/hooks/useAuth';
import { AuthFlow } from './AuthFlow';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

/**
 * Top-level auth wrapper — HYBRID model:
 *
 *  • PATIENTS authenticate via the mobile app in production. If a
 *    patient reaches the web app, AuthGate routes them to the mobile
 *    handoff screen at /patient instead of loading a patient dashboard.
 *
 *  • STAFF (admin / doctor / management / receptionist) have no
 *    MongoDB account; they live in the in-memory authStore. That
 *    session is intentionally NOT persisted, so staff still see the
 *    login screen on a fresh launch and route by their authStore role
 *    (this preserves receptionist → /check-in etc).
 *
 * Unauthenticated → the unified AuthFlow (password / email-OTP login,
 * signup, forgot-password).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading, roles } = useAuth();
  const staffUser = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();

  const hasRealSession = !!session?.user;
  const authed = hasRealSession || !!staffUser;
  // Real MongoDB sessions route by the role useAuth derived from the
  // email/API role. Staff route to their web portals; patients route to
  // the mobile handoff page. Legacy in-memory staff still route by
  // their stored role.
  const realSessionRole = roles[0];
  const realSessionHome =
    realSessionRole && realSessionRole in ROLE_ROUTE
      ? ROLE_ROUTE[realSessionRole as keyof typeof ROLE_ROUTE]
      : '/patient';
  const home = staffUser ? ROLE_ROUTE[staffUser.role] : realSessionHome;

  useEffect(() => {
    if (!authed) return;

    const path = location.pathname;
    const roleRoutes = Object.values(ROLE_ROUTE);
    const isEntryPath = path === '/' || path === '/login' || path === '/signup';
    const isForeignDashboard = roleRoutes.includes(path) && path !== home;

    if (isEntryPath || isForeignDashboard) {
      navigate(home, { replace: true });
    }
  }, [authed, home, location.pathname, navigate]);

  // Wait for MongoDB to restore a persisted session before deciding
  // (avoids a login-screen flash on reload). Staff are synchronous, so
  // don't block on them.
  if (isLoading && !staffUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (!authed) {
    return <AuthFlow />;
  }

  return <>{children}</>;
}
