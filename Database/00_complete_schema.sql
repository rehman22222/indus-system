-- =====================================================
-- PATIENTS SCHEMA
-- Patient-related tables, functions, and RLS policies
-- =====================================================

-- Create users table (includes patients)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin', 'management')),
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    allergies TEXT[],
    medical_history JSONB,
    fcm_token TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    slot_id UUID REFERENCES public.slots(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show')),
    chief_complaint TEXT,
    diagnosis TEXT,
    prescription TEXT,
    notes TEXT,
    no_show_risk_score DECIMAL(3,2),
    video_room_url TEXT,
    video_room_name TEXT,
    checked_in_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create prescriptions table
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    medications JSONB NOT NULL,
    instructions TEXT,
    notes TEXT,
    valid_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create medical records table
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    record_type TEXT NOT NULL CHECK (record_type IN ('lab_report', 'imaging', 'consultation', 'procedure', 'other')),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_type TEXT,
    recorded_date DATE NOT NULL,
    recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for patients
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON public.appointments(date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_token ON public.appointments(token);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON public.medical_records(patient_id);

-- Row Level Security Policies for Patients

-- Users table RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id AND role = 'patient');

CREATE POLICY "Patients can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id AND role = 'patient');

CREATE POLICY "Doctors can view patient profiles"
    ON public.users FOR SELECT
    USING (role = 'patient' AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'doctor'
    ));

-- Appointments table RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own appointments"
    ON public.appointments FOR SELECT
    USING (patient_id = auth.uid());

CREATE POLICY "Patients can create appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can cancel own appointments"
    ON public.appointments FOR UPDATE
    USING (patient_id = auth.uid())
    WITH CHECK (status IN ('cancelled'));

-- Prescriptions table RLS
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own prescriptions"
    ON public.prescriptions FOR SELECT
    USING (patient_id = auth.uid());

-- Medical records table RLS
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own medical records"
    ON public.medical_records FOR SELECT
    USING (patient_id = auth.uid());

-- Functions

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- =====================================================
-- DOCTORS SCHEMA
-- Doctor-related tables, functions, and RLS policies
-- =====================================================

-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    capacity INTEGER DEFAULT 50,
    floor_number INTEGER,
    contact_email TEXT,
    contact_phone TEXT,
    head_doctor_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create doctors table
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    qualification TEXT,
    experience_years INTEGER,
    license_number TEXT UNIQUE,
    consultation_fee DECIMAL(10,2),
    available_days TEXT[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
    available_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00"}'::jsonb,
    max_patients_per_day INTEGER DEFAULT 20,
    average_consultation_time INTEGER DEFAULT 30, -- minutes
    rating DECIMAL(2,1) DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    bio TEXT,
    languages TEXT[] DEFAULT ARRAY['english'],
    is_available BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create slots table
CREATE TABLE IF NOT EXISTS public.slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    max_patients INTEGER DEFAULT 1,
    current_patients INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, date, start_time)
);

-- Create doctor reviews table
CREATE TABLE IF NOT EXISTS public.doctor_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, patient_id, appointment_id)
);

-- Create indexes for doctors
CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON public.doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_department_id ON public.doctors(department_id);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON public.doctors(specialty);
CREATE INDEX IF NOT EXISTS idx_doctors_is_available ON public.doctors(is_available);
CREATE INDEX IF NOT EXISTS idx_slots_doctor_date ON public.slots(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_slots_is_available ON public.slots(is_available);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments(doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_departments_name ON public.departments(name);

-- Row Level Security Policies for Doctors

-- Departments table RLS (public read, admin write)
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view departments"
    ON public.departments FOR SELECT
    USING (true);

-- Doctors table RLS (public read)
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active doctors"
    ON public.doctors FOR SELECT
    USING (is_active = true);

CREATE POLICY "Doctors can view own profile details"
    ON public.doctors FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Doctors can update own profile"
    ON public.doctors FOR UPDATE
    USING (user_id = auth.uid());

-- Slots table RLS
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available slots"
    ON public.slots FOR SELECT
    USING (is_available = true);

CREATE POLICY "Doctors can view own slots"
    ON public.slots FOR SELECT
    USING (doctor_id IN (
        SELECT id FROM public.doctors WHERE user_id = auth.uid()
    ));

-- Appointments RLS for doctors
CREATE POLICY "Doctors can view own appointments"
    ON public.appointments FOR SELECT
    USING (doctor_id IN (
        SELECT id FROM public.doctors WHERE user_id = auth.uid()
    ));

CREATE POLICY "Doctors can update own appointments"
    ON public.appointments FOR UPDATE
    USING (doctor_id IN (
        SELECT id FROM public.doctors WHERE user_id = auth.uid()
    ));

-- Prescriptions RLS for doctors
CREATE POLICY "Doctors can create prescriptions"
    ON public.prescriptions FOR INSERT
    WITH CHECK (doctor_id IN (
        SELECT id FROM public.doctors WHERE user_id = auth.uid()
    ));

CREATE POLICY "Doctors can view own prescriptions"
    ON public.prescriptions FOR SELECT
    USING (doctor_id IN (
        SELECT id FROM public.doctors WHERE user_id = auth.uid()
    ));

-- Doctor reviews RLS
ALTER TABLE public.doctor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view doctor reviews"
    ON public.doctor_reviews FOR SELECT
    USING (true);

CREATE POLICY "Patients can create reviews for their appointments"
    ON public.doctor_reviews FOR INSERT
    WITH CHECK (patient_id = auth.uid());

-- Functions

-- Function to generate daily slots for a doctor
CREATE OR REPLACE FUNCTION public.generate_daily_slots(
    p_doctor_id UUID,
    p_date DATE,
    p_slot_duration INTEGER DEFAULT 30 -- minutes
)
RETURNS INTEGER AS $$
DECLARE
    v_start_time TIME;
    v_end_time TIME;
    v_current_time TIME;
    v_slots_created INTEGER := 0;
BEGIN
    -- Get doctor's available hours
    SELECT 
        (available_hours->>'start')::TIME,
        (available_hours->>'end')::TIME
    INTO v_start_time, v_end_time
    FROM public.doctors
    WHERE id = p_doctor_id;

    -- Check if doctor works on this day
    IF NOT EXISTS (
        SELECT 1 FROM public.doctors
        WHERE id = p_doctor_id
        AND to_char(p_date, 'Day') = ANY(available_days)
    ) THEN
        RETURN 0;
    END IF;

    v_current_time := v_start_time;

    -- Generate slots
    WHILE v_current_time < v_end_time LOOP
        INSERT INTO public.slots (doctor_id, date, start_time, end_time, is_available)
        VALUES (
            p_doctor_id,
            p_date,
            v_current_time,
            v_current_time + (p_slot_duration || ' minutes')::INTERVAL,
            true
        )
        ON CONFLICT (doctor_id, date, start_time) DO NOTHING;
        
        v_slots_created := v_slots_created + 1;
        v_current_time := v_current_time + (p_slot_duration || ' minutes')::INTERVAL;
    END LOOP;

    RETURN v_slots_created;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON public.doctors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- =====================================================
-- MANAGEMENT SCHEMA
-- Operations, queue, analytics tables and RLS policies
-- =====================================================

-- Create queue table
CREATE TABLE IF NOT EXISTS public.queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in-progress', 'completed', 'no-show')),
    called_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(appointment_id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    fcm_message_id TEXT,
    read BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analytics events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create system alerts table
CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('error', 'warning', 'info', 'success')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    source TEXT,
    metadata JSONB,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance metrics table
CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit TEXT,
    tags JSONB,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for management
CREATE INDEX IF NOT EXISTS idx_queue_status ON public.queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_position ON public.queue(position);
CREATE INDEX IF NOT EXISTS idx_queue_appointment_id ON public.queue(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_system_alerts_acknowledged ON public.system_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON public.performance_metrics(metric_name);

-- Row Level Security Policies for Management

-- Queue table RLS
ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view queue"
    ON public.queue FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Management can update queue"
    ON public.queue FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role IN ('management', 'admin', 'doctor')
    ));

-- Notifications table RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON public.notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON public.notifications FOR UPDATE
    USING (user_id = auth.uid());

-- Analytics events RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view analytics events"
    ON public.analytics_events FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role IN ('management', 'admin')
    ));

-- System alerts RLS
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view system alerts"
    ON public.system_alerts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role IN ('management', 'admin')
    ));

-- Audit logs RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Views for Management Dashboard

-- Appointment statistics view
CREATE OR REPLACE VIEW public.appointment_stats AS
SELECT 
    date,
    COUNT(*) as total_appointments,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'no-show') as no_shows,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
    AVG(no_show_risk_score) as avg_risk_score
FROM public.appointments
GROUP BY date
ORDER BY date DESC;

-- Doctor performance view
CREATE OR REPLACE VIEW public.doctor_performance AS
SELECT 
    d.id,
    d.name,
    d.specialty,
    COUNT(a.id) as total_appointments,
    COUNT(a.id) FILTER (WHERE a.status = 'completed') as completed_appointments,
    AVG(dr.rating) as average_rating,
    COUNT(dr.id) as total_reviews
FROM public.doctors d
LEFT JOIN public.appointments a ON d.id = a.doctor_id
LEFT JOIN public.doctor_reviews dr ON d.id = dr.doctor_id
GROUP BY d.id, d.name, d.specialty;

-- Queue status view
CREATE OR REPLACE VIEW public.queue_status AS
SELECT 
    q.*,
    a.date,
    a.time,
    a.patient_id,
    u.name as patient_name,
    d.name as doctor_name,
    dept.name as department_name
FROM public.queue q
JOIN public.appointments a ON q.appointment_id = a.id
JOIN public.users u ON a.patient_id = u.id
JOIN public.doctors d ON a.doctor_id = d.id
JOIN public.departments dept ON a.department_id = dept.id
ORDER BY q.position;

-- Functions

-- Function to update queue positions
CREATE OR REPLACE FUNCTION public.update_queue_positions()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate positions for waiting queue entries
    WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as new_position
        FROM public.queue
        WHERE status = 'waiting'
    )
    UPDATE public.queue q
    SET position = n.new_position
    FROM numbered n
    WHERE q.id = n.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update queue positions
CREATE TRIGGER update_queue_positions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.queue
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.update_queue_positions();

-- Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
        VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
        VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data)
        VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_queue_updated_at BEFORE UPDATE ON public.queue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- =====================================================
-- ADMIN SCHEMA
-- System configuration, settings, and admin tables
-- =====================================================

-- Create system settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create appointment governance rules table
CREATE TABLE IF NOT EXISTS public.appointment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL UNIQUE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('booking', 'cancellation', 'no_show', 'capacity', 'time_slot')),
    rule_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create holidays table
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date DATE NOT NULL UNIQUE,
    description TEXT,
    is_working_day BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admin activity logs table
CREATE TABLE IF NOT EXISTS public.admin_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    activity_description TEXT NOT NULL,
    affected_table TEXT,
    affected_record_id UUID,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for admin tables
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_appointment_rules_type ON public.appointment_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_appointment_rules_active ON public.appointment_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_id ON public.admin_activity(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON public.admin_activity(created_at);

-- Row Level Security Policies for Admin

-- System settings RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all settings"
    ON public.system_settings FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Admin can modify settings"
    ON public.system_settings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Appointment rules RLS
ALTER TABLE public.appointment_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage appointment rules"
    ON public.appointment_rules FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Admin activity RLS
ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view activity logs"
    ON public.admin_activity FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Triggers for updated_at
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointment_rules_updated_at BEFORE UPDATE ON public.appointment_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- =====================================================
-- OTP VERIFICATION SCHEMA
-- OTP and authentication tables
-- =====================================================

-- Create OTP verifications table
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- email or phone
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sessions table for tracking user sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for OTP table
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON public.otp_verifications(identifier);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON public.otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_verified ON public.otp_verifications(verified);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(is_active);

-- Row Level Security (RLS) is intentionally DISABLED for OTP table
-- OTP operations are handled by backend API with service role key

-- Row Level Security for user sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
    ON public.user_sessions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
    ON public.user_sessions FOR DELETE
    USING (user_id = auth.uid());

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void AS $$
BEGIN
    DELETE FROM public.otp_verifications
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up inactive sessions
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.user_sessions
    WHERE expires_at < NOW() OR (is_active = false AND last_active_at < NOW() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;
