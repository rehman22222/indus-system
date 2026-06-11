import { useState, useEffect, useCallback } from 'react';
import {
  MongoDB,
} from '@/integrations/mongodb/client';
import { format } from 'date-fns';

export interface AppointmentStats {
  total: number;
  confirmed: number;
  arrived: number;
  inConsultation: number;
  completed: number;
  cancelled: number;
  noShow: number;
  physical: number;
  video: number;
}

export interface DoctorStats {
  id: string;
  name: string;
  specialty: string;
  department: { id: string; name: string; color: string } | null;
  dailyPhysicalQuota: number;
  dailyVideoQuota: number;
  physicalSeen: number;
  videoSeen: number;
  totalSeen: number;
  totalQuota: number;
  utilizationRate: number;
  isActive: boolean;
}

export interface RecentCheckIn {
  id: string;
  patientName: string;
  token: string;
  doctorName: string;
  status: string;
  checkInTime: string;
  appointmentTime: string;
}

export interface SystemHealth {
  dbStatus: 'online' | 'offline';
  lastBackup: string | null;
  uptime: number;
}

export function useAdminStats(selectedDate: Date) {
  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats>({
    total: 0, confirmed: 0, arrived: 0, inConsultation: 0,
    completed: 0, cancelled: 0, noShow: 0, physical: 0, video: 0
  });
  const [doctorStats, setDoctorStats] = useState<DoctorStats[]>([]);
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [avgWaitTime, setAvgWaitTime] = useState<number>(0);

  const fetchStats = useCallback(async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    try {
      setIsLoading(true);

      // Fetch appointments for the selected date
      const { data: appointments, error: apptError } = await MongoDB
        .from('appointments')
        .select(`
          id,
          token,
          status,
          appointment_type,
          appointment_time,
          check_in_time,
          consultation_start_time,
          doctor_id,
          patient:patients(id, name:full_name),
          doctor:doctors(id, name:full_name)
        `)
        .eq('appointment_date', dateStr);

      if (apptError) throw apptError;

      // Calculate appointment stats
      const stats: AppointmentStats = {
        total: appointments?.length || 0,
        confirmed: appointments?.filter(a => a.status === 'confirmed').length || 0,
        arrived: appointments?.filter(a => a.status === 'waiting').length || 0,
        inConsultation: appointments?.filter(a => a.status === 'in_consultation').length || 0,
        completed: appointments?.filter(a => a.status === 'completed').length || 0,
        cancelled: appointments?.filter(a => a.status === 'cancelled').length || 0,
        noShow: appointments?.filter(a => a.status === 'no_show').length || 0,
        physical: appointments?.filter(a => a.appointment_type === 'physical').length || 0,
        video: appointments?.filter(a => a.appointment_type === 'video').length || 0,
      };
      setAppointmentStats(stats);

      // Calculate average wait time (for arrived/completed patients)
      const patientsWithWait = appointments?.filter(a =>
        a.check_in_time && a.consultation_start_time
      ) || [];

      if (patientsWithWait.length > 0) {
        const totalWaitMs = patientsWithWait.reduce((sum, a) => {
          const checkIn = new Date(a.check_in_time!).getTime();
          const consultStart = new Date(a.consultation_start_time!).getTime();
          return sum + (consultStart - checkIn);
        }, 0);
        setAvgWaitTime(Math.round(totalWaitMs / patientsWithWait.length / 60000)); // in minutes
      }

      // Fetch doctors with their stats for today
      const { data: doctors, error: docError } = await MongoDB
        .from('doctors')
        .select(`
          id,
          name:full_name,
          specialty,
          daily_physical_quota,
          daily_video_quota,
          is_active,
          department:departments(id, name, color)
        `)
        .eq('is_active', true);

      if (docError) throw docError;

      // Calculate per-doctor stats
      const doctorStatsData: DoctorStats[] = (doctors || []).map(doc => {
        const docAppointments = appointments?.filter(a => a.doctor_id === doc.id) || [];
        const physicalSeen = docAppointments.filter(a =>
          a.appointment_type === 'physical' &&
          ['waiting', 'in_consultation', 'completed'].includes(a.status)
        ).length;
        const videoSeen = docAppointments.filter(a =>
          a.appointment_type === 'video' &&
          ['waiting', 'in_consultation', 'completed'].includes(a.status)
        ).length;
        const totalSeen = physicalSeen + videoSeen;
        const totalQuota = (doc.daily_physical_quota || 0) + (doc.daily_video_quota || 0);

        return {
          id: doc.id,
          name: doc.name,
          specialty: doc.specialty,
          department: doc.department as unknown as { id: string; name: string; color: string } | null,
          dailyPhysicalQuota: doc.daily_physical_quota || 0,
          dailyVideoQuota: doc.daily_video_quota || 0,
          physicalSeen,
          videoSeen,
          totalSeen,
          totalQuota,
          utilizationRate: totalQuota > 0 ? Math.round((totalSeen / totalQuota) * 100) : 0,
          isActive: doc.is_active ?? true,
        };
      });
      setDoctorStats(doctorStatsData);

      // Get recent check-ins
      const recentArrivals = appointments
        ?.filter(a => ['waiting', 'in_consultation'].includes(a.status) && a.check_in_time)
        .sort((a, b) => new Date(b.check_in_time!).getTime() - new Date(a.check_in_time!).getTime())
        .slice(0, 10)
        .map(a => ({
          id: a.id,
          patientName: (a.patient as any)?.name || 'Unknown',
          token: (a as any).token || '',
          doctorName: (a.doctor as any)?.name || 'Unknown',
          status: a.status,
          checkInTime: a.check_in_time || '',
          appointmentTime: a.appointment_time,
        })) || [];
      setRecentCheckIns(recentArrivals);

    } catch (error) {
      console.error('Error fetching admin stats:', error);
      setAppointmentStats({
        total: 0, confirmed: 0, arrived: 0, inConsultation: 0,
        completed: 0, cancelled: 0, noShow: 0, physical: 0, video: 0
      });
      setDoctorStats([]);
      setRecentCheckIns([]);
      setAvgWaitTime(0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchStats();

    // Set up real-time subscription for appointments
    const channel = MongoDB
      .channel('admin-appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      MongoDB.removeChannel(channel);
    };
  }, [fetchStats]);

  return {
    appointmentStats,
    doctorStats,
    recentCheckIns,
    avgWaitTime,
    isLoading,
    refetch: fetchStats,
  };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await MongoDB
          .from('notifications')
          .select('id, user_id, title, message, type, is_read, read_at, target_role, related_entity_type, related_entity_id, is_broadcast, created_at')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        setNotifications(data || []);
        setUnreadCount((data || []).filter(n => !n.is_read).length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();

    // Real-time subscription
    const channel = MongoDB
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      MongoDB.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (notificationId: string) => {
    const { error } = await MongoDB
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    const { error } = await MongoDB
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const createNotification = async (
    title: string,
    message: string,
    type: string = 'info',
    targetRole?: string,
    isBroadcast: boolean = false
  ) => {
    const { error } = await MongoDB.from('notifications').insert([{
      title,
      message,
      type,
      target_role: targetRole as any,
      is_broadcast: isBroadcast,
    }]);
    return { error };
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    createNotification,
  };
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await MongoDB
          .from('system_settings')
          .select('key, value');

        if (error) throw error;

        const settingsMap: Record<string, any> = {};
        (data || []).forEach(s => {
          settingsMap[s.key] = s.value;
        });
        setSettings(settingsMap);
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const updateSetting = async (key: string, value: any) => {
    const { error } = await MongoDB
      .from('system_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (!error) {
      setSettings(prev => ({ ...prev, [key]: value }));
    }

    return { error };
  };

  return { settings, isLoading, updateSetting };
}

export function useAdminDoctorManagement() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDoctors = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await MongoDB
        .from('doctors')
        .select(`
          id, full_name, license_no, email, phone, specialty,
          daily_physical_quota, daily_video_quota, is_active,
          schedule, profile_image_url, created_at, updated_at,
          department:departments(id, name, color)
        `)
        .order('full_name');

      if (error) throw error;
      // Live MongoDB rows only. Alias `full_name` → `name` so
      // consumers using the legacy field name keep working. No static
      // fallback — an empty table yields an empty list.
      setDoctors((data || []).map((d: any) => ({ ...d, name: d.full_name })));
    } catch (error) {
      console.error('[useAdminDoctorManagement] fetch failed:', error);
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const createDoctor = async (doctorData: {
    name: string;
    specialty: string;
    departmentId?: string;
    email?: string;
    phone?: string;
    dailyPhysicalQuota?: number;
    dailyVideoQuota?: number;
  }) => {
    const { data, error } = await MongoDB.from('doctors').insert({
      full_name: doctorData.name,
      // license_no is NOT NULL UNIQUE in the schema; generate a placeholder
      // when admin doesn't supply one so the insert doesn't fail.
      license_no: `PMC-${Date.now()}`,
      specialty: doctorData.specialty,
      department_id: doctorData.departmentId || null,
      email: doctorData.email || null,
      phone: doctorData.phone || null,
      daily_physical_quota: doctorData.dailyPhysicalQuota || 30,
      daily_video_quota: doctorData.dailyVideoQuota || 10,
      is_active: true,
    }).select().single();

    if (!error) {
      await fetchDoctors();
    }

    return { data, error };
  };

  const updateDoctor = async (doctorId: string, updates: Partial<{
    name: string;
    specialty: string;
    department_id: string;
    email: string;
    phone: string;
    daily_physical_quota: number;
    daily_video_quota: number;
    is_active: boolean;
    schedule: any;
  }>) => {
    // Translate `name` (legacy public API of this hook) into the schema's
    // `full_name` column before sending to MongoDB.
    const { name, ...rest } = updates;
    const dbUpdates = name !== undefined ? { ...rest, full_name: name } : rest;
    const { error } = await MongoDB
      .from('doctors')
      .update(dbUpdates)
      .eq('id', doctorId);

    if (!error) {
      await fetchDoctors();
    }

    return { error };
  };

  const deactivateDoctor = async (doctorId: string) => {
    return updateDoctor(doctorId, { is_active: false });
  };

  return {
    doctors,
    isLoading,
    createDoctor,
    updateDoctor,
    deactivateDoctor,
    refetch: fetchDoctors,
  };
}

export function useAdminAppointments(selectedDate: Date) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    try {
      setIsLoading(true);

      // Use PostgREST aliasing so response keeps legacy field names
      // (name, patient_id) while reading from canonical schema columns
      // (full_name, indus_id). dob/sex are surfaced verbatim — display
      // sites that read .age/.gender will fall back to '-'.
      const { data, error } = await MongoDB
        .from('appointments')
        .select(`
          id, token, patient_id, doctor_id, appointment_date, appointment_time,
          appointment_type, status, chief_complaint, notes, diagnosis,
          check_in_time, consultation_start_time, consultation_end_time,
          no_show_score, governance_status, video_room_url, created_at, updated_at,
          patient:patients(id, name:full_name, phone, dob, sex, patient_id:indus_id),
          doctor:doctors(id, name:full_name, specialty)
        `)
        .eq('appointment_date', dateStr)
        .order('appointment_time');

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAppointments();

    const channel = MongoDB
      .channel('admin-appointments-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchAppointments()
      )
      .subscribe();

    return () => {
      MongoDB.removeChannel(channel);
    };
  }, [fetchAppointments]);

  const updateAppointmentStatus = async (
    appointmentId: string,
    status: 'confirmed' | 'waiting' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show'
  ) => {
    const { error } = await MongoDB
      .from('appointments')
      .update({ status })
      .eq('id', appointmentId);

    return { error };
  };

  const reassignDoctor = async (appointmentId: string, newDoctorId: string) => {
    const { error } = await MongoDB
      .from('appointments')
      .update({ doctor_id: newDoctorId })
      .eq('id', appointmentId);

    return { error };
  };

  const rescheduleAppointment = async (
    appointmentId: string,
    newDate: string,
    newTime: string
  ) => {
    const { error } = await MongoDB
      .from('appointments')
      .update({
        appointment_date: newDate,
        appointment_time: newTime,
      })
      .eq('id', appointmentId);

    return { error };
  };

  return {
    appointments,
    isLoading,
    updateAppointmentStatus,
    reassignDoctor,
    rescheduleAppointment,
    refetch: fetchAppointments,
  };
}

export function useAdminPatients(selectedDate: Date) {
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPatients = useCallback(async () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    try {
      setIsLoading(true);

      // Get patients with appointments for the selected date
      const { data: appointments, error } = await MongoDB
        .from('appointments')
        .select(`
          id, token, patient_id, doctor_id, appointment_date, appointment_time,
          appointment_type, status, chief_complaint, check_in_time,
          consultation_start_time, consultation_end_time, no_show_score,
          patient:patients(id, name:full_name, phone, dob, sex, blood_group,
                          patient_id:indus_id, address, allergies,
                          current_medications, emergency_contact, medical_history),
          doctor:doctors(id, name:full_name, specialty)
        `)
        .eq('appointment_date', dateStr)
        .order('appointment_time');

      if (error) throw error;

      // Map to patient-centric view
      const patientData = (appointments || []).map(appt => ({
        ...appt.patient,
        appointment: {
          id: appt.id,
          token: appt.token,
          status: appt.status,
          appointmentTime: appt.appointment_time,
          appointmentType: appt.appointment_type,
          doctorId: appt.doctor_id,
          doctorName: (appt.doctor as any)?.name,
          doctorSpecialty: (appt.doctor as any)?.specialty,
          chiefComplaint: appt.chief_complaint,
          checkInTime: appt.check_in_time,
        }
      }));

      setPatients(patientData);
    } catch (error) {
      console.error('Error fetching patients:', error);
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  return {
    patients,
    isLoading,
    refetch: fetchPatients,
  };
}
