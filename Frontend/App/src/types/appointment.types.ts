// Shared appointment types for APP
// Prevents circular imports between hooks and components

export interface Appointment {
    id: string;
    token: string;
    patient_id: string;
    doctor_id: string;
    appointment_date: string;
    appointment_time: string;
    appointment_type: 'physical' | 'video';
    status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
    chief_complaint?: string;
    check_in_time?: string;
    consultation_start_time?: string;
    consultation_end_time?: string;
    created_at?: string;
    updated_at?: string;
    doctors?: Doctor;
    patients?: Patient;
}

export interface Doctor {
    id: string;
    full_name: string;
    specialty: string;
    email?: string;
    phone?: string;
    license_no?: string;
    is_active?: boolean;
    daily_physical_quota?: number;
    daily_video_quota?: number;
    schedule?: any;
    department?: Department;
}

export interface Patient {
    id: string;
    user_id?: string;
    indus_id?: string;
    full_name: string;
    dob?: string;
    sex?: string;
    blood_group?: string;
    phone?: string;
    email?: string;
    identifiers?: any;
}

export interface Department {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    is_active?: boolean;
}

export interface CreateAppointmentInput {
    patient_id: string;
    doctor_id: string;
    appointment_date: string;
    appointment_time: string;
    appointment_type: 'physical' | 'video';
    chief_complaint?: string;
}

export interface CreateAppointmentResult {
    success: boolean;
    token?: string;
    appointment?: Appointment;
    error?: string;
}

export interface AppointmentFeatures {
    dayOfWeek: number;
    hourOfDay: number;
    isWeekend: number;
    isAfternoon: number;
    appointmentType: number;
    patientAge: number;
}
