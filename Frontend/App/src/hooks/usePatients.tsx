import { useState, useEffect } from 'react';
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

      const { data, error } = await MongoDB
        .from('patients')
        .insert({
          user_id: patientData.user_id,
          indus_id: indusId,
          full_name: patientData.name,
          phone: patientData.phone,
          email: patientData.email,
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
