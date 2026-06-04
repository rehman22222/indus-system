import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Prescription {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  diagnosis: string;
  medications: unknown;
  instructions: string | null;
  follow_up_date: string | null;
  created_at: string;
  doctor?: {
    id: string;
    name: string;
    specialty: string;
  };
  appointment?: {
    id: string;
    appointment_date: string;
    chief_complaint: string | null;
  };
}

export function usePatientPrescriptions(patientId: string | undefined) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    if (!patientId) {
      setPrescriptions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          doctor:doctors(id, name:full_name, specialty),
          appointment:appointments(id, appointment_date, chief_complaint)
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrescriptions((data || []) as Prescription[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching prescriptions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  return { prescriptions, isLoading, error, refetch: fetchPrescriptions };
}

export function useDoctorPrescriptions(doctorId: string | undefined) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrescriptions = useCallback(async () => {
    if (!doctorId) {
      setPrescriptions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patient:patients(id, patient_id:indus_id, name:full_name, dob, sex),
          appointment:appointments(id, appointment_date, chief_complaint)
        `)
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrescriptions((data || []) as unknown as Prescription[]);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching prescriptions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  return { prescriptions, isLoading, error, refetch: fetchPrescriptions };
}
