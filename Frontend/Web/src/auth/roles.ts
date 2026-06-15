import type { UserRole } from '@/integrations/mongodb/types';

export const ROLE_ROUTE: Record<UserRole, string> = {
  ADMIN: '/admin',
  DOCTOR: '/doctor',
  MANAGEMENT: '/management',
  PATIENT: '/patient',
  RECEPTIONIST: '/check-in',
};
