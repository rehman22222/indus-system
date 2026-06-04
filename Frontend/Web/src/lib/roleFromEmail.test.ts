import { describe, it, expect } from 'vitest';
import { roleFromEmail } from './roleFromEmail';

describe('roleFromEmail', () => {
  it('maps the staff email patterns (case-insensitive, optional digits)', () => {
    expect(roleFromEmail('admin@indus.org.pk')).toBe('ADMIN');
    expect(roleFromEmail('Admin7@INDUS.org.pk')).toBe('ADMIN');
    expect(roleFromEmail('doctor3@indus.org.pk')).toBe('DOCTOR');
    expect(roleFromEmail('management@indus.org.pk')).toBe('MANAGEMENT');
  });

  it('returns null for non-staff or malformed emails (caller defaults to PATIENT)', () => {
    expect(roleFromEmail('patient@gmail.com')).toBeNull();
    expect(roleFromEmail('admin@evil.com')).toBeNull();      // wrong domain
    expect(roleFromEmail('adminx@indus.org.pk')).toBeNull(); // extra chars
    expect(roleFromEmail('superadmin@indus.org.pk')).toBeNull();
    expect(roleFromEmail('')).toBeNull();
    expect(roleFromEmail(null)).toBeNull();
    expect(roleFromEmail(undefined)).toBeNull();
  });
});
