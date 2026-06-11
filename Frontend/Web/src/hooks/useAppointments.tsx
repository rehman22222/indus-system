import { useState, useEffect, useCallback } from 'react';
import { MongoDB } from '@/integrations/mongodb/client';
import { generateUniqueToken } from '@/lib/tokenGenerator';
import { predictNoShow } from '@/lib/noShowPredictor';
import type { AppointmentFeatures } from '@/lib/noShowPredictor';
import { APPOINTMENT_LIST_SELECT, APPOINTMENT_DETAIL_SELECT } from '@/integrations/mongodb/queries';
import type { Appointment, AppointmentStatus, CreateAppointmentResult } from '@/integrations/mongodb/types';

// Re-export so components importing `Appointment` from this hook resolve
// to the canonical DB type.
export type { Appointment } from '@/integrations/mongodb/types';

export interface CreateAppointmentInput {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: 'physical' | 'video';
  chief_complaint?: string;
  doctor_specialty?: string;
}

export function useAppointments(patientId?: string, date?: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAppointments = async () => {
      // Don't fetch if no patientId
      if (!patientId) {
        if (isMounted) {
          setAppointments([]);
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        let query = MongoDB
          .from('appointments')
          .select(APPOINTMENT_LIST_SELECT)
          .order('appointment_date', { ascending: true });

        if (patientId) {
          query = query.eq('patient_id', patientId);
        }
        if (date) {
          query = query.eq('appointment_date', date);
        }

        const { data, error: fetchErr } = await query;

        if (fetchErr) throw fetchErr;
        if (isMounted) {
          setAppointments((data ?? []) as any);
        }
      } catch (err) {
        console.warn('[useAppointments] Fetch failed:', err);
        if (isMounted) {
          setAppointments([]);
          setError(err instanceof Error ? err.message : 'Fetch failed');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAppointments();

    return () => {
      isMounted = false;
    };
  }, [patientId, date]);

  const fetchAppointments = useCallback(async () => {
    // Manual refetch function
    setLoading(true);
    setError(null);

    try {
      let query = MongoDB
        .from('appointments')
        .select(APPOINTMENT_LIST_SELECT)
        .order('appointment_date', { ascending: true });

      if (patientId) {
        query = query.eq('patient_id', patientId);
      }
      if (date) {
        query = query.eq('appointment_date', date);
      }

      const { data, error: fetchErr } = await query;

      if (fetchErr) throw fetchErr;
      setAppointments((data ?? []) as any);
    } catch (err) {
      console.warn('[useAppointments] Fetch failed:', err);
      setAppointments([]);
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [patientId, date]);

  const createAppointment = useCallback(
    async (
      input: CreateAppointmentInput
    ): Promise<CreateAppointmentResult> => {
      // Validate required fields
      if (!input.patient_id)
        return { success: false, error: 'Patient ID is required.' };
      if (!input.doctor_id)
        return { success: false, error: 'Doctor is required.' };
      if (!input.appointment_date)
        return { success: false, error: 'Date is required.' };
      if (!input.appointment_time)
        return { success: false, error: 'Time is required.' };
      if (!input.appointment_type)
        return { success: false, error: 'Appointment type is required.' };

      // Generate no-show prediction
      const features: AppointmentFeatures = {
        specialty: input.doctor_specialty ?? 'General Medicine',
        appointment_type: input.appointment_type,
        appointment_date: input.appointment_date,
        appointment_time: input.appointment_time,
        booking_created_at: new Date().toISOString(),
      };
      const prediction = predictNoShow(features);

      // LIVE MODE — create in MongoDB
      try {
        const token = await generateUniqueToken(
          input.doctor_id,
          input.appointment_date
        );

        const insertData = {
          token,
          patient_id: input.patient_id,
          doctor_id: input.doctor_id,
          appointment_date: input.appointment_date,
          appointment_time: input.appointment_time,
          appointment_type: input.appointment_type,
          status: 'confirmed',
          chief_complaint: input.chief_complaint ?? null,
          no_show_score: prediction.score,
          governance_status: 'pending',
        };

        const { data, error: insertErr } = await MongoDB
          .from('appointments')
          .insert(insertData)
          .select(APPOINTMENT_DETAIL_SELECT)
          .single();

        if (insertErr) {
          // Handle specific MongoDB errors
          if (insertErr.code === '23505') {
            return {
              success: false,
              error:
                'This time slot is already booked. Please choose another time.',
            };
          }
          if (insertErr.code === '23503') {
            return {
              success: false,
              error: 'Invalid patient or doctor. Please try again.',
            };
          }
          throw insertErr;
        }

        const created = data as any; // MongoDB returns joined data with nested objects

        // Send FCM notification (non-blocking — don't await)
        MongoDB.functions
          .invoke('send-notification', {
            body: {
              user_id: input.patient_id,
              title: 'Appointment Confirmed ✅',
              body: `Your token is ${token}. Date: ${input.appointment_date} at ${input.appointment_time}`,
              data: {
                type: 'appointment_confirmed',
                appointment_id: created.id,
              },
            },
          })
          .catch(() => { }); // never block booking on notification failure

        setAppointments((prev) => [...prev, created]);
        return { success: true, token, appointment: created };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Booking failed. Please try again.';
        return { success: false, error: msg };
      }
    },
    []
  );

  return {
    appointments,
    loading,
    error,
    fetchAppointments,
    createAppointment,
  };
}

// Legacy export for backward compatibility
export function useCreateAppointment() {
  const { createAppointment } = useAppointments();
  const [isLoading, setIsLoading] = useState(false);

  const wrappedCreate = async (input: CreateAppointmentInput) => {
    setIsLoading(true);
    const result = await createAppointment(input);
    setIsLoading(false);

    // Return in old format for compatibility
    return {
      data: result.success ? { token: result.token, ...result.appointment } : null,
      error: result.error ? new Error(result.error) : null,
    };
  };

  return { createAppointment: wrappedCreate, isLoading };
}

// Hook for fetching doctor's appointments
export function useDoctorAppointments(doctorId?: string, date?: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!doctorId) {
      setAppointments([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = MongoDB
        .from('appointments')
        .select(APPOINTMENT_DETAIL_SELECT)
        .eq('doctor_id', doctorId)
        .order('appointment_time', { ascending: true });

      if (date) {
        query = query.eq('appointment_date', date);
      }

      const { data, error: fetchErr } = await query;

      if (fetchErr) throw fetchErr;
      setAppointments((data ?? []) as any); // MongoDB returns joined data
    } catch (err) {
      console.warn('[useDoctorAppointments] Fetch failed:', err);
      setAppointments([]);
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setIsLoading(false);
    }
  }, [doctorId, date]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    appointments,
    isLoading,
    error,
    refetch,
  };
}

// Hook for updating appointment status
export function useUpdateAppointment() {
  const [isLoading, setIsLoading] = useState(false);

  const updateAppointment = useCallback(async (
    appointmentId: string,
    updates: Partial<Appointment>
  ) => {
    setIsLoading(true);

    try {
      const { error: updateErr } = await MongoDB
        .from('appointments')
        .update(updates)
        .eq('id', appointmentId);

      if (updateErr) throw updateErr;

      setIsLoading(false);
      return { success: true };
    } catch (err) {
      console.error('[useUpdateAppointment] Update failed:', err);
      setIsLoading(false);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Update failed'
      };
    }
  }, []);

  return {
    updateAppointment,
    isLoading,
  };
}

// Hook for check-in functionality
export interface CheckInResult {
  success: boolean;
  error?: string;
}

export function useCheckIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkInByToken = useCallback(
    async (token: string): Promise<CheckInResult & { appointment?: Appointment }> => {
      if (!token?.trim()) {
        return { success: false, error: 'Please enter a valid token.' };
      }

      setLoading(true);
      setError(null);

      try {
        // Find appointment by token
        const { data: appointment, error: fetchErr } = await MongoDB
          .from('appointments')
          .select(APPOINTMENT_DETAIL_SELECT)
          .eq('token', token.trim().toUpperCase())
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (!appointment) {
          return {
            success: false,
            error: 'Token not found. Please check the token and try again.',
          };
        }

        if (appointment.status === 'cancelled') {
          return {
            success: false,
            error: 'This appointment has been cancelled.',
          };
        }

        if (appointment.check_in_time) {
          return {
            success: true,
            appointment: appointment as any,
            // Already checked in — still return success
          };
        }

        // Mark as checked in
        const { error: updateErr } = await MongoDB
          .from('appointments')
          .update({
            status: 'waiting' as AppointmentStatus,
            check_in_time: new Date().toISOString(),
          })
          .eq('id', appointment.id);

        if (updateErr) throw updateErr;

        const checkedIn = {
          ...appointment,
          status: 'waiting' as AppointmentStatus,
          check_in_time: new Date().toISOString(),
        };

        return { success: true, appointment: checkedIn as unknown as Appointment };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Check-in failed. Please try again.';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { checkInByToken, loading, error };
}

// Hook for admin appointments
export function useAdminAppointments(date?: string) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    try {
      let query = MongoDB
        .from('appointments')
        .select(APPOINTMENT_LIST_SELECT)
        .order('appointment_date', { ascending: false });

      if (date) query = query.eq('appointment_date', date);

      const { data, error } = await query;
      if (error) throw error;

      setAppointments((data ?? []) as any); // MongoDB returns joined data with nested objects
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { appointments, loading, refetch: fetchAll };
}

// Hook for management appointments (same as admin)
export function useManagementAppointments(date?: string) {
  return useAdminAppointments(date);
}
