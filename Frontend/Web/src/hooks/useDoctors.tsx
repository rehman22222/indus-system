import { useState, useEffect } from 'react';
import { MongoDB } from '@/integrations/mongodb/client';
import { safeQuery } from '@/lib/safeQuery';
import { DOCTOR_LIST_SELECT, DOCTOR_DETAIL_SELECT } from '@/integrations/mongodb/queries';
import { getCached, setCached, CACHE_TTL } from '@/lib/queryCache';
import type { Doctor } from '@/integrations/mongodb/types';


const CACHE_KEY = 'doctors:active';

export type DoctorWithName = Doctor & { name: string };

const withNameAlias = (d: Doctor): DoctorWithName => ({ ...d, name: d.full_name });


export function useDoctors() {
  const [doctors, setDoctors] = useState<DoctorWithName[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    const cached = getCached<DoctorWithName[]>(CACHE_KEY);
    if (cached && cached.length > 0) {
      setDoctors(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const data = await safeQuery(
      () =>
        MongoDB
          .from('doctors')
          .select(DOCTOR_LIST_SELECT)
          .eq('is_active', true)
          .order('full_name', { ascending: true }),
      []
    );

    // Live MongoDB rows only. No static / mock fallback — if the
    // table is empty the list is empty.
    const liveAliased = (data as Doctor[] || []).map(withNameAlias);

    setDoctors(liveAliased);
    setError(null);
    setIsLoading(false);

    if (liveAliased.length > 0) {
      setCached(CACHE_KEY, liveAliased, CACHE_TTL.DOCTORS);
    }
  };

  const getDoctorById = (id: string) => doctors.find((d) => d.id === id);

  return { doctors, isLoading, error, refetch: fetchDoctors, getDoctorById };
}


export function useDoctorByUserId(userId: string | undefined) {
  const [doctor, setDoctor] = useState<DoctorWithName | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setDoctor(null);
      setIsLoading(false);
      return;
    }

    const fetchDoctor = async () => {
      try {
        setIsLoading(true);

        const data = await safeQuery(
          () =>
            MongoDB
              .from('doctors')
              .select(DOCTOR_DETAIL_SELECT)
              .eq('user_id', userId)
              .single(),
          null
        );

        setDoctor(data ? withNameAlias(data as Doctor) : null);
        setError(null);
      } catch (err) {
        setError(err as Error);
        setDoctor(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoctor();
  }, [userId]);

  return { doctor, isLoading, error };
}


/**
 * Resolve the signed-in doctor by email.
 *
 * The unified in-memory login (src/auth) is the real entry point, and
 * the synthetic bridge user it produces only carries an email — its
 * `id` is the email string, NOT the uuid `doctors.user_id`. Filtering
 * `user_id` (a uuid column) by an email string makes PostgREST return
 * HTTP 400. Email is the stable join key here: useStaffCredentials
 * writes doctors.email, and this also works for a real MongoDB user.
 *
 * `ilike` (exact, no wildcards) makes the match case-insensitive,
 * since authStore lowercases emails but the admin may have typed mixed
 * case when creating the doctor.
 */
export function useDoctorByEmail(email: string | undefined) {
  const [doctor, setDoctor] = useState<DoctorWithName | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDoctor = async () => {
    if (!email) {
      setDoctor(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);

      const data = await safeQuery(
        () =>
          MongoDB
            .from('doctors')
            .select(DOCTOR_DETAIL_SELECT)
            .ilike('email', email)
            .maybeSingle(),
        null,
      );

      setDoctor(data ? withNameAlias(data as Doctor) : null);
      setError(null);
    } catch (err) {
      setError(err as Error);
      setDoctor(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  return { doctor, isLoading, error, refetch: fetchDoctor };
}