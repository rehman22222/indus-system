import mongoose from '../config/mongodb.js';

const { Schema, model, models, Types } = mongoose;

const timestamps = {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
};

const objectId = (ref, required = false) => ({
    type: Schema.Types.ObjectId,
    ref,
    required,
});

const appointmentStatuses = [
    'scheduled',
    'confirmed',
    'waiting',
    'called',
    'in_consultation',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled',
];

const queueStatuses = ['waiting', 'called', 'in_consultation', 'completed', 'no_show'];

function normalizeStatusValue(value) {
    if (!value) return value;
    const key = String(value).trim().toLowerCase().replace(/\s+/g, '_');
    if (key === 'in-progress' || key === 'in_progress' || key === 'inprogress') return 'in_consultation';
    if (key === 'no-show' || key === 'noshow') return 'no_show';
    return key;
}

const UserSchema = new Schema(
    {
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        name: { type: String, trim: true },
        password_hash: { type: String, select: false },
        role: {
            type: String,
            enum: ['patient', 'doctor', 'admin', 'management', 'receptionist'],
            default: 'patient',
            index: true,
        },
        date_of_birth: String,
        gender: { type: String, enum: ['male', 'female', 'other', null], default: null },
        address: String,
        city: String,
        state: String,
        zip_code: String,
        emergency_contact_name: String,
        emergency_contact_phone: String,
        blood_group: {
            type: String,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null],
            default: null,
        },
        allergies: { type: [String], default: [] },
        medical_history: { type: Schema.Types.Mixed, default: {} },
        fcm_token: String,
        push_tokens: {
            type: [
                {
                    token: { type: String, required: true },
                    provider: {
                        type: String,
                        enum: ['fcm', 'apns', 'expo', 'unknown'],
                        default: 'unknown',
                    },
                    platform: {
                        type: String,
                        enum: ['android', 'ios', 'web', 'unknown'],
                        default: 'unknown',
                    },
                    device_name: String,
                    last_seen_at: { type: Date, default: Date.now },
                    created_at: { type: Date, default: Date.now },
                },
            ],
            default: [],
        },
        avatar_url: String,
        auth_provider: { type: String, default: 'otp' },
        last_login_at: Date,
        is_active: { type: Boolean, default: true, index: true },
    },
    timestamps,
);
UserSchema.index(
    { email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
UserSchema.index(
    { phone: 1 },
    { unique: true, partialFilterExpression: { phone: { $type: 'string' } } },
);
UserSchema.index({ role: 1, is_active: 1 });
UserSchema.index({ name: 'text', email: 'text', phone: 'text' });
UserSchema.index({ 'push_tokens.token': 1 }, { sparse: true });

const DepartmentSchema = new Schema(
    {
        name: { type: String, required: true, trim: true, unique: true },
        description: String,
        icon: { type: String, default: 'Stethoscope' },
        color: { type: String, default: '#0ea5e9' },
        capacity: { type: Number, default: 50, min: 0 },
        floor_number: Number,
        contact_email: String,
        contact_phone: String,
        head_doctor_id: objectId('Doctor'),
        is_active: { type: Boolean, default: true, index: true },
    },
    timestamps,
);
const DoctorSchema = new Schema(
    {
        user_id: objectId('User'),
        name: { type: String, required: true, trim: true },
        specialty: { type: String, required: true, trim: true, index: true },
        department_id: objectId('Department', true),
        qualification: String,
        experience_years: { type: Number, min: 0 },
        license_number: String,
        consultation_fee: { type: Number, min: 0 },
        available_days: {
            type: [String],
            default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        },
        available_hours: {
            type: Schema.Types.Mixed,
            default: () => ({ start: '09:00', end: '17:00' }),
        },
        max_patients_per_day: { type: Number, default: 20, min: 1 },
        average_consultation_time: { type: Number, default: 30, min: 1 },
        rating: { type: Number, default: 0, min: 0, max: 5 },
        total_reviews: { type: Number, default: 0, min: 0 },
        bio: String,
        languages: { type: [String], default: ['english'] },
        is_available: { type: Boolean, default: true, index: true },
        is_active: { type: Boolean, default: true, index: true },
    },
    timestamps,
);
DoctorSchema.index(
    { license_number: 1 },
    { unique: true, partialFilterExpression: { license_number: { $type: 'string' } } },
);
DoctorSchema.index({ department_id: 1, specialty: 1, is_available: 1 });
DoctorSchema.index({ name: 'text', specialty: 'text', qualification: 'text' });

const SlotSchema = new Schema(
    {
        doctor_id: objectId('Doctor', true),
        date: { type: String, required: true, index: true },
        start_time: { type: String, required: true },
        end_time: { type: String, required: true },
        is_available: { type: Boolean, default: true, index: true },
        max_patients: { type: Number, default: 1, min: 1 },
        current_patients: { type: Number, default: 0, min: 0 },
    },
    timestamps,
);
SlotSchema.index({ doctor_id: 1, date: 1, start_time: 1 }, { unique: true });
SlotSchema.index({ doctor_id: 1, date: 1, is_available: 1 });

const AppointmentSchema = new Schema(
    {
        patient_id: objectId('User', true),
        doctor_id: objectId('Doctor', true),
        department_id: objectId('Department', true),
        slot_id: objectId('Slot'),
        date: { type: String, required: true, alias: 'appointment_date', index: true },
        time: { type: String, required: true, alias: 'appointment_time' },
        appointment_type: { type: String, enum: ['physical', 'video'], default: 'physical' },
        token: { type: String, required: true, unique: true, uppercase: true, trim: true },
        status: {
            type: String,
            enum: appointmentStatuses,
            default: 'scheduled',
            index: true,
            set: normalizeStatusValue,
        },
        chief_complaint: String,
        diagnosis: String,
        prescription: String,
        notes: String,
        no_show_risk_score: { type: Number, alias: 'no_show_score', min: 0, max: 1 },
        governance_status: String,
        governance_notes: String,
        video_room_url: String,
        video_room_name: String,
        consent_recorded: { type: Boolean, default: false },
        consent_recorded_at: Date,
        checked_in_at: Date,
        check_in_time: Date,
        consultation_start_time: Date,
        consultation_end_time: Date,
        completed_at: Date,
    },
    timestamps,
);
AppointmentSchema.index({ patient_id: 1, date: 1 });
AppointmentSchema.index({ doctor_id: 1, date: 1, time: 1 });
AppointmentSchema.index({ date: 1, status: 1 });
AppointmentSchema.index(
    { patient_id: 1, doctor_id: 1, slot_id: 1 },
    {
        unique: true,
        partialFilterExpression: {
            slot_id: { $type: 'objectId' },
            status: { $in: ['scheduled', 'confirmed', 'waiting', 'called', 'in_consultation'] },
        },
    },
);
AppointmentSchema.index({ status: 1, doctor_id: 1, date: 1 });
const PrescriptionSchema = new Schema(
    {
        appointment_id: objectId('Appointment', true),
        doctor_id: objectId('Doctor', true),
        patient_id: objectId('User', true),
        diagnosis: String,
        medications: { type: [Schema.Types.Mixed], required: true },
        instructions: String,
        notes: String,
        follow_up_date: String,
        valid_until: String,
    },
    timestamps,
);
PrescriptionSchema.index({ patient_id: 1, created_at: -1 });
PrescriptionSchema.index({ doctor_id: 1, created_at: -1 });

const MedicalRecordSchema = new Schema(
    {
        patient_id: objectId('User', true),
        appointment_id: objectId('Appointment'),
        record_type: {
            type: String,
            enum: ['lab_report', 'imaging', 'consultation', 'procedure', 'other'],
            required: true,
        },
        title: { type: String, required: true },
        description: String,
        file_url: String,
        file_type: String,
        recorded_date: { type: String, required: true },
        recorded_by: objectId('User'),
    },
    timestamps,
);
MedicalRecordSchema.index({ patient_id: 1, recorded_date: -1 });

const QueueEntrySchema = new Schema(
    {
        appointment_id: objectId('Appointment', true),
        position: { type: Number, required: true, min: 1, index: true },
        status: {
            type: String,
            enum: queueStatuses,
            default: 'waiting',
            index: true,
            set: normalizeStatusValue,
        },
        called_at: Date,
    },
    { ...timestamps, collection: 'queue' },
);
QueueEntrySchema.index({ appointment_id: 1 }, { unique: true });
QueueEntrySchema.index({ status: 1, position: 1 });

const NotificationSchema = new Schema(
    {
        user_id: objectId('User', true),
        title: { type: String, required: true },
        body: { type: String, required: true },
        data: { type: Schema.Types.Mixed, default: {} },
        fcm_message_id: String,
        read: { type: Boolean, default: false, index: true },
        sent_at: { type: Date, default: Date.now },
        read_at: Date,
    },
    timestamps,
);
NotificationSchema.index({ user_id: 1, read: 1, created_at: -1 });

const OtpVerificationSchema = new Schema(
    {
        identifier: { type: String, required: true, lowercase: true, trim: true, index: true },
        code_hash: { type: String, required: true, select: false },
        expires_at: { type: Date, required: true },
        verified: { type: Boolean, default: false, index: true },
        verified_at: Date,
        attempts: { type: Number, default: 0, min: 0 },
        max_attempts: { type: Number, default: 5, min: 1 },
    },
    { ...timestamps, collection: 'otp_verifications' },
);
OtpVerificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
OtpVerificationSchema.index({ identifier: 1, verified: 1, created_at: -1 });

const AnalyticsEventSchema = new Schema(
    {
        event_type: { type: String, required: true, index: true },
        event_data: { type: Schema.Types.Mixed, required: true },
        user_id: objectId('User'),
        session_id: String,
        ip_address: String,
        user_agent: String,
    },
    { ...timestamps, collection: 'analytics_events' },
);
AnalyticsEventSchema.index({ event_type: 1, created_at: -1 });

const AuditLogSchema = new Schema(
    {
        user_id: objectId('User'),
        action: { type: String, required: true, index: true },
        collection_name: { type: String, required: true },
        record_id: Schema.Types.ObjectId,
        old_data: Schema.Types.Mixed,
        new_data: Schema.Types.Mixed,
        ip_address: String,
        user_agent: String,
    },
    { ...timestamps, collection: 'audit_logs' },
);
AuditLogSchema.index({ collection_name: 1, record_id: 1, created_at: -1 });

const SystemSettingSchema = new Schema(
    {
        setting_key: { type: String, required: true, unique: true },
        setting_value: { type: Schema.Types.Mixed, required: true },
        description: String,
        is_public: { type: Boolean, default: false, index: true },
        updated_by: objectId('User'),
    },
    { ...timestamps, collection: 'system_settings' },
);

const AppointmentRuleSchema = new Schema(
    {
        rule_name: { type: String, required: true, unique: true },
        rule_type: {
            type: String,
            enum: ['booking', 'cancellation', 'no_show', 'capacity', 'time_slot'],
            required: true,
            index: true,
        },
        rule_config: { type: Schema.Types.Mixed, required: true },
        is_active: { type: Boolean, default: true, index: true },
        priority: { type: Number, default: 0 },
    },
    { ...timestamps, collection: 'appointment_rules' },
);
AppointmentRuleSchema.index({ rule_type: 1, is_active: 1, priority: -1 });

export const User = models.User || model('User', UserSchema);
export const Department = models.Department || model('Department', DepartmentSchema);
export const Doctor = models.Doctor || model('Doctor', DoctorSchema);
export const Slot = models.Slot || model('Slot', SlotSchema);
export const Appointment = models.Appointment || model('Appointment', AppointmentSchema);
export const Prescription = models.Prescription || model('Prescription', PrescriptionSchema);
export const MedicalRecord = models.MedicalRecord || model('MedicalRecord', MedicalRecordSchema);
export const QueueEntry = models.QueueEntry || model('QueueEntry', QueueEntrySchema);
export const Notification = models.Notification || model('Notification', NotificationSchema);
export const OtpVerification =
    models.OtpVerification || model('OtpVerification', OtpVerificationSchema);
export const AnalyticsEvent = models.AnalyticsEvent || model('AnalyticsEvent', AnalyticsEventSchema);
export const AuditLog = models.AuditLog || model('AuditLog', AuditLogSchema);
export const SystemSetting = models.SystemSetting || model('SystemSetting', SystemSettingSchema);
export const AppointmentRule = models.AppointmentRule || model('AppointmentRule', AppointmentRuleSchema);

export const appModels = [
    User,
    Department,
    Doctor,
    Slot,
    Appointment,
    Prescription,
    MedicalRecord,
    QueueEntry,
    Notification,
    OtpVerification,
    AnalyticsEvent,
    AuditLog,
    SystemSetting,
    AppointmentRule,
];

export { Types };
