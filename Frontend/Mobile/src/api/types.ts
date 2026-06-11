export type UserRole = 'admin' | 'management' | 'doctor' | 'patient' | 'receptionist';

export type User = {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  phone?: string;
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
  status: string;
  chief_complaint?: string;
  doctor?: Doctor;
  patient?: User & { full_name?: string };
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
