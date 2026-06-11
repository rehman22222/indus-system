/**
 * Scoped MongoDB query selects
 * Never use .select('*') - always specify columns needed
 */

// Doctor queries
export const DOCTOR_LIST_SELECT = 'id, full_name, specialty, daily_physical_quota, daily_video_quota, profile_image_url, consultation_fee, is_active';
export const DOCTOR_DETAIL_SELECT = 'id, full_name, specialty, email, phone, qualifications, experience_years, consultation_fee, daily_physical_quota, daily_video_quota, schedule, bio, profile_image_url, is_active';
export const DOCTOR_SCHEDULE_SELECT = 'id, full_name, schedule, daily_physical_quota, daily_video_quota';

// Patient queries
export const PATIENT_LIST_SELECT = 'id, indus_id, full_name, dob, sex, blood_group, phone, email, created_at';
export const PATIENT_DETAIL_SELECT = 'id, indus_id, full_name, dob, sex, blood_group, phone, email, address, emergency_contact, medical_history, allergies, current_medications';
export const PATIENT_PROFILE_SELECT = 'id, indus_id, full_name, dob, sex, blood_group, phone, email, emergency_contact';

// Appointment queries
export const APPOINTMENT_LIST_SELECT = 'id, token, patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, chief_complaint, no_show_score, created_at, updated_at, patient:patients(id, name:full_name, phone), doctor:doctors(id, name:full_name, specialty)';
export const APPOINTMENT_DETAIL_SELECT = 'id, token, patient_id, doctor_id, appointment_date, appointment_time, appointment_type, status, chief_complaint, notes, diagnosis, check_in_time, consultation_start_time, consultation_end_time, consent_recorded, consent_recorded_at, no_show_score, governance_status, governance_notes, video_room_url, created_at, updated_at, patient:patients(id, patient_id:indus_id, name:full_name, phone, email, address, dob, sex, blood_group, allergies, current_medications), doctor:doctors(id, name:full_name, specialty, phone)';
export const APPOINTMENT_QUEUE_SELECT = 'id, token, appointment_time, status, check_in_time, patient:patients(full_name, phone)';
export const APPOINTMENT_TOKEN_CHECK_SELECT = 'id';

// Slot queries
export const SLOT_AVAILABILITY_SELECT = 'id, slot_time, is_available';
export const SLOT_LIST_SELECT = 'id, slot_date, slot_time, is_available, appointment_id';

// Department queries
export const DEPARTMENT_LIST_SELECT = 'id, name, description, icon, color, is_active';

// Notification queries
export const NOTIFICATION_LIST_SELECT = 'id, title, message, type, is_read, read_at, created_at, related_entity_type, related_entity_id';
export const NOTIFICATION_UNREAD_COUNT_SELECT = 'id';

// Audit log queries
export const AUDIT_LOG_LIST_SELECT = 'id, action, entity_type, entity_id, timestamp, actor_user_id';
export const AUDIT_LOG_DETAIL_SELECT = 'id, action, entity_type, entity_id, before, after, ip_address, user_agent, timestamp, actor_user_id';
