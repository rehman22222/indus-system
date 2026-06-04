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
