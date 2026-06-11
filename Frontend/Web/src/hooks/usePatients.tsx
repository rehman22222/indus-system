import { useState, useEffect, useRef, useCallback } from 'react';
import { MongoDB } from '@/integrations/mongodb/client';
import { safeQuery } from '@/lib/safeQuery';
import { PATIENT_DETAIL_SELECT } from '@/integrations/mongodb/queries';
import type { Patient } from '@/integrations/mongodb/types';

// PatientWithLegacyAlias: many components were written against an older
// shape that exposed `name`, `patient_id`, `age`, and `gender`. Surface
// those as derived aliases so the UI keeps working without rewriting
// every consumer. The canonical fields (`full_name`, `indus_id`, `dob`,
// `sex`) remain available on the same object.
export type PatientWithLegacyAlias = Patient & {
  name: string;
  patient_id: string;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
};

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
  return years;
}

function genderFromSex(sex: Patient['sex']): 'male' | 'female' | 'other' | null {
  if (sex === 'Male') return 'male';
  if (sex === 'Female') return 'female';
  if (sex === 'Other') return 'other';
  return null;
}

const withPatientAliases = (p: Patient): PatientWithLegacyAlias => ({
  ...p,
  name: p.full_name,
  patient_id: p.indus_id ?? '',
  age: ageFromDob(p.dob),
  gender: genderFromSex(p.sex),
});

export function usePatientByUserId(userId: string | undefined) {
  const [patient, setPatient] = useState<PatientWithLegacyAlias | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setPatient(null);
      setIsLoading(false);
      return;
    }

    const fetchPatient = async () => {
      try {
        setIsLoading(true);
        const data = await safeQuery(
          () => MongoDB
            .from('patients')
            .select(PATIENT_DETAIL_SELECT)
            .eq('user_id', userId)
            .single(),
          null
        );

        setPatient(data ? withPatientAliases(data as Patient) : null);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setPatient(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatient();
  }, [userId]);

  const updatePatient = async (updates: Partial<Patient>) => {
    if (!patient) return { error: new Error('No patient loaded') };

    try {
      const { data, error } = await MongoDB
        .from('patients')
        .update(updates)
        .eq('id', patient.id)
        .select()
        .single();

      if (error) throw error;
      const aliased = withPatientAliases(data as Patient);
      setPatient(aliased);
      return { data: aliased, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  };

  return { patient, isLoading, error, updatePatient };
}

const AUTH_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve the signed-in patient for the real-MongoDB-session model.
 *
 * Patients now have a persisted MongoDB session, so `user.id` is a
 * real auth uuid that matches `patients.user_id`. We still fall back to
 * an email match so rows created earlier (when only `patients.email`
 * was written) keep resolving. Pass the auth user object directly.
 */
export function usePatientByAuth(
  user: { id?: string; email?: string } | null | undefined,
) {
  const [patient, setPatient] = useState<PatientWithLegacyAlias | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const uid = user?.id;
  const email = user?.email;
  const reqRef = useRef(0);

  const refetch = useCallback(async () => {
    if (!uid && !email) {
      setPatient(null);
      setIsLoading(false);
      return;
    }
    const myReq = ++reqRef.current;
    try {
      setIsLoading(true);
      let row: Patient | null = null;

      // 1. Real session → match the auth uuid.
      if (uid && AUTH_UUID_RE.test(uid)) {
        row = (await safeQuery(
          () => MongoDB
            .from('patients')
            .select(PATIENT_DETAIL_SELECT)
            .eq('user_id', uid)
            .maybeSingle(),
          null,
        )) as Patient | null;
      }
      // 2. Legacy / fallback → match by email.
      if (!row && email) {
        row = (await safeQuery(
          () => MongoDB
            .from('patients')
            .select(PATIENT_DETAIL_SELECT)
            .ilike('email', email)
            .maybeSingle(),
          null,
        )) as Patient | null;
      }

      if (reqRef.current !== myReq) return;
      setPatient(row ? withPatientAliases(row) : null);
      setError(null);
    } catch (err) {
      if (reqRef.current !== myReq) return;
      setError(err as Error);
      setPatient(null);
    } finally {
      if (reqRef.current === myReq) setIsLoading(false);
    }
  }, [uid, email]);

  useEffect(() => { refetch(); }, [refetch]);

  const updatePatient = async (updates: Partial<Patient>) => {
    if (!patient) return { error: new Error('No patient loaded') };
    try {
      const { data, error } = await MongoDB
        .from('patients')
        .update(updates)
        .eq('id', patient.id)
        .select()
        .single();
      if (error) throw error;
      const aliased = withPatientAliases(data as Patient);
      setPatient(aliased);
      return { data: aliased, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  };

  return { patient, isLoading, error, updatePatient, refetch };
}

/**
 * Resolve the signed-in patient by email.
 *
 * Same reasoning as useDoctorByEmail: the unified in-memory login is
 * the real entry point, and the synthetic bridge user only carries an
 * email — its `id` is the email string, NOT the uuid `patients.user_id`.
 * Filtering the uuid column by an email makes PostgREST return HTTP 400.
 * `patients.email` is the stable join key (useCreatePatient writes it).
 * `ilike` makes the match case-insensitive (authStore lowercases).
 */
export function usePatientByEmail(email: string | undefined) {
  const [patient, setPatient] = useState<PatientWithLegacyAlias | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!email) {
      setPatient(null);
      setIsLoading(false);
      return;
    }

    const fetchPatient = async () => {
      try {
        setIsLoading(true);
        const data = await safeQuery(
          () => MongoDB
            .from('patients')
            .select(PATIENT_DETAIL_SELECT)
            .ilike('email', email)
            .maybeSingle(),
          null
        );

        setPatient(data ? withPatientAliases(data as Patient) : null);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setPatient(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatient();
  }, [email]);

  const updatePatient = async (updates: Partial<Patient>) => {
    if (!patient) return { error: new Error('No patient loaded') };

    try {
      const { data, error } = await MongoDB
        .from('patients')
        .update(updates)
        .eq('id', patient.id)
        .select()
        .single();

      if (error) throw error;
      const aliased = withPatientAliases(data as Patient);
      setPatient(aliased);
      return { data: aliased, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  };

  return { patient, isLoading, error, updatePatient };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useCreatePatient() {
  const [isLoading, setIsLoading] = useState(false);

  const createPatient = async (patientData: {
    user_id: string;
    name: string;
    phone: string;
    email?: string;
    age?: number;
    gender?: 'male' | 'female' | 'other';
  }) => {
    try {
      setIsLoading(true);

      // Generate patient ID
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 9000 + 1000);
      const indusId = `IND-${year}-${randomNum}`;

      // Under the in-memory auth bridge, patientData.user_id is the
      // user's EMAIL, not a uuid. Writing that into the uuid
      // patients.user_id column triggers a 400. Only persist it when
      // it's a real uuid; otherwise leave user_id null and rely on
      // the email column as the join key (see usePatientByEmail).
      const realUserId = UUID_RE.test(patientData.user_id)
        ? patientData.user_id
        : null;
      const emailValue =
        patientData.email ||
        (UUID_RE.test(patientData.user_id) ? undefined : patientData.user_id);

      const { data, error } = await MongoDB
        .from('patients')
        .insert({
          user_id: realUserId,
          indus_id: indusId,
          full_name: patientData.name,
          phone: patientData.phone,
          email: emailValue,
          dob: patientData.age ? new Date(new Date().getFullYear() - patientData.age, 0, 1).toISOString().split('T')[0] : undefined,
          sex: patientData.gender === 'male' ? 'Male' : patientData.gender === 'female' ? 'Female' : 'Other',
        })
        .select()
        .single();

      if (error) throw error;
      return { data: withPatientAliases(data as Patient), error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    } finally {
      setIsLoading(false);
    }
  };

  return { createPatient, isLoading };
}
