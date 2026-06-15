export type UserRole = 'admin' | 'management' | 'doctor' | 'patient' | 'receptionist';

export type User = {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  blood_group?: string;
  allergies?: string[];
  current_medications?: string[];
  medical_history?: unknown;
};

export type AuthSession = {
  token: string;
  user: User;
};

export type Department = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
};

export type Doctor = {
  id: string;
  name: string;
  full_name?: string;
  specialty: string;
  department_id?: string;
  qualification?: string;
  rating?: number;
  consultation_fee?: number;
  user_id?: string;
  email?: string;
  phone?: string;
  department?: { id: string; name: string; color?: string };
  experience_years?: number;
  license_number?: string;
  license_no?: string;
  daily_physical_quota?: number;
  daily_video_quota?: number;
  max_patients_per_day?: number;
  available_days?: string[];
  available_hours?: Record<string, { start: string; end: string }>;
  schedule?: Record<string, { start: string; end: string }>;
  average_consultation_time?: number;
  bio?: string;
  languages?: string[];
};

export type Slot = {
  id: string;
  doctor_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  current_patients?: number;
  max_patients?: number;
};

export type Appointment = {
  id: string;
  token: string;
  patient_id: string;
  doctor_id: string;
  department_id?: string;
  slot_id?: string;
  date?: string;
  time?: string;
  appointment_date?: string;
  appointment_time?: string;
  appointment_type: 'physical' | 'video';
  visit_type?: 'new' | 'follow_up';
  status: string;
  chief_complaint?: string;
  history_summary?: string;
  notes?: string;
  diagnosis?: string;
  consent_recorded?: boolean;
  consent_recorded_at?: string;
  consultation_start_time?: string;
  consultation_end_time?: string;
  created_at?: string;
  updated_at?: string;
  doctor?: Doctor;
  patient?: User & { full_name?: string; patient_id?: string; dob?: string; sex?: string };
};

export type Medication = {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
};

export type Prescription = {
  id: string;
  appointment_id: Appointment | string;
  doctor_id: Doctor | string;
  patient_id: User | string;
  diagnosis?: string;
  medications: Medication[];
  instructions?: string;
  notes?: string;
  follow_up_date?: string;
  valid_until?: string;
  created_at?: string;
  updated_at?: string;
};

export type QueueEntry = {
  id: string;
  appointment_id: Appointment | string;
  position: number;
  status: string;
};

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  message?: string;
  type?: string;
  read?: boolean;
  is_read?: boolean;
  created_at?: string;
  sent_at?: string;
};
