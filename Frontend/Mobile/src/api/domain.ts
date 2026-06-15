import { apiRequest, buildQuery } from '@/api/client';
import type { Appointment, Department, Doctor, Medication, Prescription, QueueEntry, Slot } from '@/api/types';

export async function getDepartments() {
  const response = await apiRequest<{ departments?: Department[]; data?: Department[] }>('/api/v1/departments', {
    auth: false,
  });
  return response.departments || response.data || [];
}

export async function getDoctors(params: { department_id?: string; search?: string; email?: string } = {}) {
  const response = await apiRequest<{ doctors?: Doctor[]; data?: Doctor[] }>(
    `/api/v1/doctors${buildQuery(params)}`,
    { auth: false },
  );
  return response.doctors || response.data || [];
}

export async function getCurrentDoctor(email: string) {
  const doctors = await getDoctors({ email: email.trim().toLowerCase() });
  return doctors[0];
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

export async function getAppointmentById(appointmentId: string) {
  const response = await apiRequest<{ appointment?: Appointment; data?: Appointment }>(
    `/api/v1/appointments/${appointmentId}`,
  );
  return response.appointment || response.data;
}

export type PatientProfile = {
  id: string;
  full_name?: string;
  name?: string;
  indus_id?: string;
  patient_id?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
};

export async function getMyProfile(userId: string) {
  const response = await apiRequest<{ patient?: PatientProfile; data?: PatientProfile }>(
    `/api/v1/patients/${userId}`,
  );
  return response.patient || response.data;
}

export async function getPrescriptions(params: { appointmentId?: string; patientId?: string } = {}) {
  const response = await apiRequest<{ prescriptions?: Prescription[]; data?: Prescription[] }>(
    `/api/v1/prescriptions${buildQuery(params)}`,
  );
  return response.prescriptions || response.data || [];
}

export async function createAppointment(input: {
  patient_id: string;
  doctor_id: string;
  department_id?: string;
  slot_id?: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: 'physical' | 'video';
  visit_type?: 'new' | 'follow_up';
  chief_complaint?: string;
  history_summary?: string;
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

export async function updateAppointment(appointmentId: string, updates: Partial<Pick<Appointment,
  'status' | 'notes' | 'diagnosis' | 'consent_recorded' | 'consent_recorded_at' |
  'consultation_start_time' | 'consultation_end_time'
>>) {
  const response = await apiRequest<{ appointment?: Appointment; data?: Appointment }>(
    `/api/v1/appointments/${appointmentId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    },
  );
  return response.appointment || response.data;
}


export async function updateAppointmentStatus(appointmentId: string, status: string) {
  return updateAppointment(appointmentId, { status });
}

export async function createPrescription(input: {
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  diagnosis?: string;
  medications: Medication[];
  instructions?: string;
  notes?: string;
  follow_up_date?: string;
}) {
  const response = await apiRequest<{ prescription?: Prescription; data?: Prescription }>('/api/v1/prescriptions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.prescription || response.data;
}
