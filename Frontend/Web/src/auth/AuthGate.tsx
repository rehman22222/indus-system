import { useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROLE_ROUTE } from './roles';
import { useAuth } from '@/hooks/useAuth';
import { AuthFlow } from './AuthFlow';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

/**
 * Top-level backend-backed authentication wrapper.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, isLoading, roles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const authed = !!session?.user;
  const realSessionRole = roles[0];
  const realSessionHome =
    realSessionRole && realSessionRole in ROLE_ROUTE
      ? ROLE_ROUTE[realSessionRole as keyof typeof ROLE_ROUTE]
      : '/patient';
  const home = realSessionHome;

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

  if (isLoading) {
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
