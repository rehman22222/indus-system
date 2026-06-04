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
