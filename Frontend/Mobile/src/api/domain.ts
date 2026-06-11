import { apiRequest, buildQuery } from '@/api/client';
import type { Appointment, Department, Doctor, QueueEntry, Slot } from '@/api/types';

export async function getDepartments() {
  const response = await apiRequest<{ departments?: Department[]; data?: Department[] }>('/api/v1/departments', {
    auth: false,
  });
  return response.departments || response.data || [];
}

export async function getDoctors(params: { department_id?: string; search?: string } = {}) {
  const response = await apiRequest<{ doctors?: Doctor[]; data?: Doctor[] }>(
    `/api/v1/doctors${buildQuery(params)}`,
    { auth: false },
  );
  return response.doctors || response.data || [];
}

export async function getSlots(params: { doctor_id?: string; date?: string; available?: boolean }) {
  const response = await apiRequest<{ slots?: Slot[]; data?: Slot[] }>(
    `/api/v1/slots${buildQuery({
      ...params,
      available: params.available === undefined ? undefined : String(params.available),
    })}`,
    { auth: false },
  );
  return response.slots || response.data || [];
}

export async function getAppointments(params: Record<string, string>) {
  const response = await apiRequest<{ appointments?: Appointment[]; data?: Appointment[] }>(
    `/api/v1/appointments${buildQuery(params)}`,
  );
  return response.appointments || response.data || [];
}

export async function createAppointment(input: {
  patient_id: string;
  doctor_id: string;
  department_id?: string;
  slot_id?: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: 'physical' | 'video';
  chief_complaint?: string;
}) {
  const response = await apiRequest<{ appointment?: Appointment; data?: Appointment }>('/api/v1/appointments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.appointment || response.data;
}

export async function getQueue(params: { doctor_id?: string; date?: string }) {
  const response = await apiRequest<{ queue?: QueueEntry[]; data?: QueueEntry[] }>(
    `/api/v1/queue${buildQuery(params)}`,
  );
  return response.queue || response.data || [];
}

export async function updateAppointmentStatus(appointmentId: string, status: string) {
  const response = await apiRequest<{ appointment?: Appointment; data?: Appointment }>(
    `/api/v1/appointments/${appointmentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
  return response.appointment || response.data;
}
