/**
 * TypeScript types matching the exact database schema
 * DO NOT modify these without updating the database schema
 */

export type UserRole = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'MANAGEMENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type AppointmentStatus = 'confirmed' | 'waiting' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
export type AppointmentType = 'physical' | 'video';
export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'reminder';
export type GovernanceStatus = 'pending' | 'approved' | 'rejected';
export type Sex = 'Male' | 'Female' | 'Other';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type NoShowRiskLabel = 'low' | 'medium' | 'high';

export interface User {
    id: string;
    email: string;
    phone?: string;
    role: UserRole;
    status: UserStatus;
    last_login_at?: string;
    created_at: string;
    updated_at: string;
}

export interface Patient {
    id: string;
    user_id: string;
    indus_id?: string;
    full_name: string;
    dob?: string;
    sex?: Sex;
    blood_group?: BloodGroup;
    phone?: string;
    email?: string;
    address?: string;
    emergency_contact?: {
        name: string;
        phone: string;
        relationship: string;
    };
    medical_history?: Record<string, any>;
    allergies?: string[];
    current_medications?: string[];
    identifiers?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

// PatientSummary: Used in list views where user_id may not be loaded
export interface PatientSummary {
    id: string;
    user_id?: string;
    indus_id?: string;
    full_name: string;
    dob?: string;
    sex?: Sex;
    blood_group?: BloodGroup;
    phone?: string;
    email?: string;
    address?: string;
    emergency_contact?: {
        name: string;
        phone: string;
        relationship: string;
    };
    medical_history?: Record<string, any>;
    allergies?: string[];
    current_medications?: string[];
    identifiers?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface Doctor {
    id: string;
    user_id: string;
    full_name: string;
    license_no: string;
    email?: string;
    phone?: string;
    specialty: string;
    department_id?: string;
    qualifications?: string[];
    experience_years?: number;
    consultation_fee?: number;
    daily_physical_quota: number;
    daily_video_quota: number;
    is_active: boolean;
    schedule?: Record<string, { start: string; end: string }>;
    bio?: string;
    profile_image_url?: string;
    created_at: string;
    updated_at: string;
}

export interface Department {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
}

export interface Appointment {
    id: string;
    token: string;
    patient_id: string;
    doctor_id: string;
    appointment_date: string;
    appointment_time: string;
    appointment_type: AppointmentType;
    status: AppointmentStatus;
    chief_complaint?: string | null;
    notes?: string | null;
    diagnosis?: string | null;
    prescription?: Record<string, unknown> | null;
    lab_tests?: Record<string, unknown> | null;
    follow_up_date?: string | null;
    video_room_url?: string | null;
    check_in_time?: string | null;
    consultation_start_time?: string | null;
    consultation_end_time?: string | null;
    no_show_score?: number | null;
    governance_status?: GovernanceStatus | null;
    governance_reviewed_by?: string | null;
    governance_reviewed_at?: string | null;
    governance_notes?: string | null;
    created_at: string;
    updated_at: string;
}

export interface AppointmentSlot {
    id: string;
    doctor_id: string;
    slot_date: string;
    slot_time: string;
    is_available: boolean;
    appointment_id?: string;
    created_at: string;
}

export interface Notification {
    id: string;
    user_id?: string;
    title: string;
    message: string;
    type: NotificationType;
    target_role?: UserRole | 'ALL';
    related_entity_type?: string;
    related_entity_id?: string;
    is_broadcast: boolean;
    is_read: boolean;
    read_at?: string;
    fcm_token?: string;
    sent_at?: string;
    created_at: string;
}

export interface AuditLog {
    id: string;
    actor_user_id?: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    before?: Record<string, any>;
    after?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    timestamp: string;
}

export interface DailyStats {
    date: string;
    total_appointments: number;
    confirmed: number;
    waiting: number;
    in_consultation: number;
    completed: number;
    cancelled: number;
    no_show: number;
    rescheduled: number;
    physical: number;
    video: number;
    high_risk_no_show?: number;
    pending_governance?: number;
}

export interface CreateAppointmentResult {
    success: boolean;
    appointment?: Appointment;
    token?: string;
    error?: string;
}
