import type { UserRole } from '@/integrations/mongodb/types';

/**
 * Single source of truth for "which portal does this email belong to?"
 *
 * Conventions:
 *   admin<n>@indus.org.pk      → ADMIN
 *   doctor<n>@indus.org.pk     → DOCTOR
 *   management<n>@indus.org.pk → MANAGEMENT
 *   anything else              → null  (caller defaults to PATIENT)
 *
 * Trailing digits after the role are optional (admin@…, admin7@…).
 * Matching is case-insensitive.
 */
export function roleFromEmail(
  email: string | null | undefined,
): UserRole | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (/^admin\d*@indus\.org\.pk$/.test(e)) return 'ADMIN';
  if (/^doctor\d*@indus\.org\.pk$/.test(e)) return 'DOCTOR';
  if (/^management\d*@indus\.org\.pk$/.test(e)) return 'MANAGEMENT';
  return null;
}
