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
