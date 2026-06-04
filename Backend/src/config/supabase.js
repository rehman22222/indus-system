import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('⚠️  Missing Supabase environment variables');
    console.error('Please configure SUPABASE_URL and SUPABASE_ANON_KEY in Backend/.env');
    process.exit(1);
}

// Client for public operations (user auth context)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: false
    }
});

// Admin client for service operations (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export default supabase;
