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
