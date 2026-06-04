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
