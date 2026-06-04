import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
    try {
      setIsLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data: appointments, error: apptError } = await supabase
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

      const patientsWithWait = appointments?.filter(a =>
        a.check_in_time && a.consultation_start_time
      ) || [];

      if (patientsWithWait.length > 0) {
        const totalWaitMs = patientsWithWait.reduce((sum, a) => {
          const checkIn = new Date(a.check_in_time!).getTime();
          const consultStart = new Date(a.consultation_start_time!).getTime();
          return sum + (consultStart - checkIn);
        }, 0);
        setAvgWaitTime(Math.round(totalWaitMs / patientsWithWait.length / 60000));
      }

      const { data: doctors, error: docError } = await supabase
        .from('doctors')
        .select(`
          id,
          full_name,
          specialty,
          daily_physical_quota,
          daily_video_quota,
          is_active,
          department:departments(id, name, color)
        `)
        .eq('is_active', true);

      if (docError) throw docError;

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
          name: doc.full_name,
          specialty: doc.specialty,
          department: doc.department as { id: string; name: string; color: string } | null,
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
      console.error('[useAdminStats] Fetch failed:', error);
      setRecentCheckIns([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('admin-appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
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
  }, []);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
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

  return { notifications, unreadCount, isLoading, markAsRead, refetch: fetchNotifications };
}

export function useAdminDoctorManagement() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDoctors = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id, full_name, license_no, email, phone, specialty,
          daily_physical_quota, daily_video_quota, is_active,
          schedule, profile_image_url, created_at, updated_at,
          department:departments(id, name, color)
        `)
        .order('full_name');

      if (error) throw error;
      setDoctors((data || []).map((d: any) => ({ ...d, name: d.full_name })));
    } catch (error) {
      console.error('Error fetching doctors:', error);
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const createDoctor = async (doctorData: any) => {
    const { data, error } = await supabase.from('doctors').insert({
      full_name: doctorData.name,
      license_no: `PMC-${Date.now()}`,
      specialty: doctorData.specialty,
      department_id: doctorData.departmentId || null,
      email: doctorData.email || null,
      phone: doctorData.phone || null,
      daily_physical_quota: doctorData.dailyPhysicalQuota || 30,
      daily_video_quota: doctorData.dailyVideoQuota || 10,
      is_active: true,
    }).select().single();

    if (!error) await fetchDoctors();
    return { data, error };
  };

  const updateDoctor = async (doctorId: string, updates: any) => {
    const { name, ...rest } = updates;
    const dbUpdates = name !== undefined ? { ...rest, full_name: name } : rest;
    const { error } = await supabase.from('doctors').update(dbUpdates).eq('id', doctorId);
    if (!error) await fetchDoctors();
    return { error };
  };

  return { doctors, isLoading, createDoctor, updateDoctor, refetch: fetchDoctors };
}

export function useAdminAppointments(selectedDate: Date) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    try {
      setIsLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
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
    const channel = supabase
      .channel('admin-appointments-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => fetchAppointments()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAppointments]);

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', appointmentId);
    return { error };
  };

  return { appointments, isLoading, updateAppointmentStatus, refetch: fetchAppointments };
}

export function useAdminPatients(selectedDate: Date) {
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
          id, token, patient_id, doctor_id, appointment_date, appointment_time,
          appointment_type, status, chief_complaint, check_in_time,
          patient:patients(id, name:full_name, phone, dob, sex, patient_id:indus_id),
          doctor:doctors(id, name:full_name, specialty)
        `)
        .eq('appointment_date', dateStr);

      if (error) throw error;
      setPatients((appointments || []).map(appt => ({
        ...appt.patient,
        appointment: {
          id: appt.id,
          token: appt.token,
          status: appt.status,
          appointmentTime: appt.appointment_time,
          doctorName: (appt.doctor as any)?.name,
          checkInTime: appt.check_in_time,
        }
      })));
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

  return { patients, isLoading, refetch: fetchPatients };
}
