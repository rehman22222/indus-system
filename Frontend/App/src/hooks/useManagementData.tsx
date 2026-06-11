import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MongoDB,
} from '@/integrations/mongodb/client';
import { toast } from 'sonner';

// Types
export interface DoctorWithStats {
  id: string;
  name: string;
  specialty: string;
  department_id: string | null;
  daily_physical_quota: number;
  daily_video_quota: number;
  is_active: boolean;
  schedule: Record<string, { start: string; end: string }>;
  department?: {
    id: string;
    name: string;
    color: string;
  } | null;
  // Computed stats for today
  seen: number;
  remaining: number;
  physicalCount: number;
  videoCount: number;
  avgWaitTime: number;
}

export interface AppointmentWithDetails {
  id: string;
  token: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: 'physical' | 'video';
  status: 'confirmed' | 'waiting' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';
  chief_complaint: string | null;
  check_in_time: string | null;
  consultation_start_time: string | null;
  consultation_end_time: string | null;
  patient?: {
    id: string;
    patient_id: string;
    name: string;
    phone: string;
    age: number | null;
    gender: string | null;
  };
  doctor?: {
    id: string;
    name: string;
    specialty: string;
  };
}

export interface ManagementStats {
  totalPatients: number;
  arrivedCount: number;
  waitingCount: number;
  inConsultationCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  physicalCount: number;
  videoCount: number;
  avgWaitTime: number;
  noShowRate: number;
  utilizationRate: number;
}

export interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  doctorId?: string;
  doctorName?: string;
  actionLabel?: string;
}

// Hook for management dashboard stats
export function useManagementStats(date: string) {
  const [stats, setStats] = useState<ManagementStats>({
    totalPatients: 0,
    arrivedCount: 0,
    waitingCount: 0,
    inConsultationCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    noShowCount: 0,
    physicalCount: 0,
    videoCount: 0,
    avgWaitTime: 0,
    noShowRate: 0,
    utilizationRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch all appointments for the date
      const { data: appointments, error } = await MongoDB
        .from('appointments')
        .select('id, status, appointment_type, check_in_time, consultation_start_time')
        .eq('appointment_date', date);

      if (error) throw error;

      // Fetch total doctor capacity
      const { data: doctors, error: docError } = await MongoDB
        .from('doctors')
        .select('daily_physical_quota, daily_video_quota')
        .eq('is_active', true);

      if (docError) throw docError;

      const totalQuota = doctors?.reduce((sum, d) => 
        sum + (d.daily_physical_quota || 0) + (d.daily_video_quota || 0), 0) || 0;

      // Calculate stats
      const total = appointments?.length || 0;
      const arrived = appointments?.filter(a => a.status === 'waiting').length || 0;
      const waiting = appointments?.filter(a => ['confirmed', 'waiting'].includes(a.status)).length || 0;
      const inConsultation = appointments?.filter(a => a.status === 'in_consultation').length || 0;
      const completed = appointments?.filter(a => a.status === 'completed').length || 0;
      const cancelled = appointments?.filter(a => a.status === 'cancelled').length || 0;
      const noShow = appointments?.filter(a => a.status === 'no_show').length || 0;
      const physical = appointments?.filter(a => a.appointment_type === 'physical').length || 0;
      const video = appointments?.filter(a => a.appointment_type === 'video').length || 0;

      // Calculate average wait time for completed appointments
      let totalWaitTime = 0;
      let waitTimeCount = 0;
      appointments?.forEach(a => {
        if (a.check_in_time && a.consultation_start_time) {
          const waitMs = new Date(a.consultation_start_time).getTime() - new Date(a.check_in_time).getTime();
          totalWaitTime += waitMs / 60000; // Convert to minutes
          waitTimeCount++;
        }
      });

      const avgWait = waitTimeCount > 0 ? Math.round(totalWaitTime / waitTimeCount) : 0;
      const noShowRateCalc = total > 0 ? Math.round((noShow / total) * 100 * 10) / 10 : 0;
      const utilization = totalQuota > 0 ? Math.round((completed / totalQuota) * 100) : 0;

      setStats({
        totalPatients: total,
        arrivedCount: arrived,
        waitingCount: waiting,
        inConsultationCount: inConsultation,
        completedCount: completed,
        cancelledCount: cancelled,
        noShowCount: noShow,
        physicalCount: physical,
        videoCount: video,
        avgWaitTime: avgWait,
        noShowRate: noShowRateCalc,
        utilizationRate: utilization,
      });
    } catch (err) {
      console.error('Error fetching management stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchStats();

    // Real-time subscription
    const channel = MongoDB
      .channel(`management-stats-${date}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `appointment_date=eq.${date}` },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      MongoDB.removeChannel(channel);
    };
  }, [date, fetchStats]);

  return { stats, isLoading, refetch: fetchStats };
}

// Hook for doctors with computed stats
export function useManagementDoctors(date: string) {
  const [doctors, setDoctors] = useState<DoctorWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDoctors = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch all doctors. Use full_name instead of legacy `name`, and
      // skip the departments join when the FK relationship is not
      // declared yet — the safeQuery layer will catch PGRST200 if it is
      // missing, but we avoid the round-trip by selecting plain columns
      // here.
      const { data: doctorsData, error: docError } = await MongoDB
        .from('doctors')
        .select('*')
        .order('full_name');

      if (docError) throw docError;

      // Fetch all appointments for the date
      const { data: appointments, error: apptError } = await MongoDB
        .from('appointments')
        .select('id, doctor_id, status, appointment_type, check_in_time, consultation_start_time')
        .eq('appointment_date', date);

      if (apptError) throw apptError;

      // Compute stats for each doctor
      const doctorsWithStats: DoctorWithStats[] = (doctorsData || []).map((doc: any) => {
        const docAppointments = appointments?.filter(a => a.doctor_id === doc.id) || [];
        const completed = docAppointments.filter(a => a.status === 'completed').length;
        const physical = docAppointments.filter(a => a.appointment_type === 'physical').length;
        const video = docAppointments.filter(a => a.appointment_type === 'video').length;
        const totalQuota = (doc.daily_physical_quota || 0) + (doc.daily_video_quota || 0);

        // Calculate avg wait time
        let totalWait = 0;
        let waitCount = 0;
        docAppointments.forEach(a => {
          if (a.check_in_time && a.consultation_start_time) {
            const waitMs = new Date(a.consultation_start_time).getTime() - new Date(a.check_in_time).getTime();
            totalWait += waitMs / 60000;
            waitCount++;
          }
        });

        return {
          id: doc.id,
          name: doc.name,
          specialty: doc.specialty,
          department_id: doc.department_id,
          daily_physical_quota: doc.daily_physical_quota || 30,
          daily_video_quota: doc.daily_video_quota || 10,
          is_active: doc.is_active ?? true,
          schedule: doc.schedule || {},
          department: doc.department,
          seen: completed,
          remaining: Math.max(0, totalQuota - docAppointments.length),
          physicalCount: physical,
          videoCount: video,
          avgWaitTime: waitCount > 0 ? Math.round(totalWait / waitCount) : 0,
        };
      });

      setDoctors(doctorsWithStats);
    } catch (err) {
      console.error('Error fetching management doctors:', err);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchDoctors();

    const channel = MongoDB
      .channel(`management-doctors-${date}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => fetchDoctors())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => fetchDoctors())
      .subscribe();

    return () => {
      MongoDB.removeChannel(channel);
    };
  }, [date, fetchDoctors]);

  const updateDoctorQuota = async (doctorId: string, physicalQuota: number, videoQuota: number) => {
    try {
      const { error } = await MongoDB
        .from('doctors')
        .update({ 
          daily_physical_quota: physicalQuota,
          daily_video_quota: videoQuota,
          updated_at: new Date().toISOString()
        })
        .eq('id', doctorId);

      if (error) throw error;
      toast.success('Doctor quota updated successfully');
      fetchDoctors();
    } catch (err) {
      toast.error('Failed to update quota');
      console.error(err);
    }
  };

  const addEmergencySlots = async (doctorId: string, additionalSlots: number = 5) => {
    try {
      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) return;

      const { error } = await MongoDB
        .from('doctors')
        .update({ 
          daily_physical_quota: doctor.daily_physical_quota + additionalSlots,
          updated_at: new Date().toISOString()
        })
        .eq('id', doctorId);

      if (error) throw error;
      toast.success(`Added ${additionalSlots} emergency slots for ${doctor.name}`);
      fetchDoctors();
    } catch (err) {
      toast.error('Failed to add emergency slots');
      console.error(err);
    }
  };

  const updateDoctorSchedule = async (doctorId: string, schedule: Record<string, { start: string; end: string }>) => {
    try {
      const { error } = await MongoDB
        .from('doctors')
        .update({ 
          schedule,
          updated_at: new Date().toISOString()
        })
        .eq('id', doctorId);

      if (error) throw error;
      toast.success('Schedule updated successfully');
      fetchDoctors();
    } catch (err) {
      toast.error('Failed to update schedule');
      console.error(err);
    }
  };

  return {
    doctors,
    isLoading,
    refetch: fetchDoctors,
    updateDoctorQuota,
    addEmergencySlots,
    updateDoctorSchedule,
  };
}

// Hook for appointments with management actions
export function useManagementAppointments(date: string, doctorId?: string | null) {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    try {
      setIsLoading(true);

      let query = MongoDB
        .from('appointments')
        .select(`
          id, token, patient_id, doctor_id, appointment_date, appointment_time,
          appointment_type, status, chief_complaint, check_in_time,
          consultation_start_time, consultation_end_time, no_show_score,
          governance_status, video_room_url, created_at, updated_at,
          patient:patients(id, patient_id:indus_id, name:full_name, phone, dob, sex),
          doctor:doctors(id, name:full_name, specialty)
        `)
        .eq('appointment_date', date)
        .order('appointment_time', { ascending: true });

      if (doctorId) {
        query = query.eq('doctor_id', doctorId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAppointments((data || []) as AppointmentWithDetails[]);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [date, doctorId]);

  useEffect(() => {
    fetchAppointments();

    const channel = MongoDB
      .channel(`management-appointments-${date}-${doctorId || 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchAppointments()
      )
      .subscribe();

    return () => {
      MongoDB.removeChannel(channel);
    };
  }, [date, doctorId, fetchAppointments]);

  const updateAppointmentStatus = async (appointmentId: string, status: string, additionalData?: Record<string, unknown>) => {
    try {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'waiting' && !additionalData?.check_in_time) {
        updates.check_in_time = new Date().toISOString();
      }
      if (status === 'in_consultation' && !additionalData?.consultation_start_time) {
        updates.consultation_start_time = new Date().toISOString();
      }
      if (status === 'completed' && !additionalData?.consultation_end_time) {
        updates.consultation_end_time = new Date().toISOString();
      }

      const { error } = await MongoDB
        .from('appointments')
        .update({ ...updates, ...additionalData })
        .eq('id', appointmentId);

      if (error) throw error;
      toast.success(`Appointment marked as ${status}`);
      fetchAppointments();
    } catch (err) {
      toast.error('Failed to update appointment status');
      console.error(err);
    }
  };

  const reassignDoctor = async (appointmentId: string, newDoctorId: string) => {
    try {
      const { error } = await MongoDB
        .from('appointments')
        .update({ doctor_id: newDoctorId })
        .eq('id', appointmentId);

      if (error) throw error;
      toast.success('Patient reassigned to new doctor');
      fetchAppointments();
    } catch (err) {
      toast.error('Failed to reassign patient');
      console.error(err);
    }
  };

  const rescheduleAppointment = async (appointmentId: string, newDate: string, newTime: string) => {
    try {
      const { error } = await MongoDB
        .from('appointments')
        .update({ 
          appointment_date: newDate,
          appointment_time: newTime,
        })
        .eq('id', appointmentId);

      if (error) throw error;
      toast.success('Appointment rescheduled successfully');
      fetchAppointments();
    } catch (err) {
      toast.error('Failed to reschedule appointment');
      console.error(err);
    }
  };

  return {
    appointments,
    isLoading,
    refetch: fetchAppointments,
    updateAppointmentStatus,
    reassignDoctor,
    rescheduleAppointment,
  };
}

// Hook for generating predictive alerts
export function useManagementAlerts(doctors: DoctorWithStats[], appointments: AppointmentWithDetails[]) {
  const alerts = useMemo<Alert[]>(() => {
    const generatedAlerts: Alert[] = [];

    doctors.forEach(doctor => {
      const totalQuota = doctor.daily_physical_quota + doctor.daily_video_quota;
      const docAppointments = appointments.filter(a => a.doctor_id === doctor.id);
      const activeAppointments = docAppointments.filter(a => 
        !['completed', 'cancelled', 'no_show'].includes(a.status)
      );

      // Alert: Doctor nearing capacity
      if (doctor.remaining <= 2 && doctor.remaining > 0) {
        generatedAlerts.push({
          id: `capacity-low-${doctor.id}`,
          type: 'warning',
          title: `Low Capacity - ${doctor.name}`,
          description: `Only ${doctor.remaining} slots remaining for today.`,
          doctorId: doctor.id,
          doctorName: doctor.name,
          actionLabel: 'Add Slots',
        });
      }

      // Alert: Doctor at full capacity
      if (doctor.remaining === 0 && activeAppointments.length > 0) {
        generatedAlerts.push({
          id: `capacity-full-${doctor.id}`,
          type: 'danger',
          title: `Full Capacity - ${doctor.name}`,
          description: `No slots remaining. ${activeAppointments.length} patients still waiting.`,
          doctorId: doctor.id,
          doctorName: doctor.name,
          actionLabel: 'Reassign Patients',
        });
      }

      // Alert: High wait time
      if (doctor.avgWaitTime > 30) {
        generatedAlerts.push({
          id: `wait-time-${doctor.id}`,
          type: 'warning',
          title: `High Wait Time - ${doctor.name}`,
          description: `Average wait time is ${doctor.avgWaitTime} minutes, above target of 30 minutes.`,
          doctorId: doctor.id,
          doctorName: doctor.name,
          actionLabel: 'Review Queue',
        });
      }
    });

    // System-wide alerts
    const waitingCount = appointments.filter(a => a.status === 'waiting').length;
    if (waitingCount > 20) {
      generatedAlerts.push({
        id: 'system-queue-high',
        type: 'danger',
        title: 'High Queue Volume',
        description: `${waitingCount} patients currently waiting across all departments.`,
        actionLabel: 'View Queue',
      });
    }

    return generatedAlerts;
  }, [doctors, appointments]);

  return { alerts };
}

// Hook for broadcast notifications
export function useManagementBroadcast() {
  const [isSending, setIsSending] = useState(false);

  const sendBroadcast = async (message: string, title: string, targetRole?: 'admin' | 'management' | 'doctor' | 'patient' | 'receptionist') => {
    try {
      setIsSending(true);

      const { error } = await MongoDB
        .from('notifications')
        .insert({
          title,
          message,
          is_broadcast: true,
          type: 'broadcast',
          target_role: targetRole || null,
        });

      if (error) throw error;
      toast.success('Broadcast message sent successfully');
    } catch (err) {
      toast.error('Failed to send broadcast');
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return { sendBroadcast, isSending };
}

// Hook for blocking/unblocking all slots
export function useSlotManagement() {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check current block status from system settings
    const checkBlockStatus = async () => {
      try {
        const { data } = await MongoDB
          .from('system_settings')
          .select('value')
          .eq('key', 'slots_blocked')
          .single();

        if (data?.value) {
          setIsBlocked((data.value as { blocked: boolean }).blocked || false);
        }
      } catch {
        // expected when system_settings doesn't exist yet — leave default
      }
    };
    checkBlockStatus();
  }, []);

  const toggleBlockAllSlots = async () => {
    try {
      setIsLoading(true);
      const newBlockedState = !isBlocked;

      const { error } = await MongoDB
        .from('system_settings')
        .upsert({
          key: 'slots_blocked',
          value: { blocked: newBlockedState, blocked_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setIsBlocked(newBlockedState);
      toast.success(newBlockedState ? 'All slots blocked' : 'All slots unblocked');
    } catch (err) {
      toast.error('Failed to toggle slot blocking');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return { isBlocked, toggleBlockAllSlots, isLoading };
}
