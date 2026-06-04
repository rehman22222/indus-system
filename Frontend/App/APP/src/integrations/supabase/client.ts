import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export const isSupabaseConfigured = true;

const supabaseUrl = env.SUPABASE_URL ?? '';
const supabaseAnonKey = env.SUPABASE_ANON_KEY ?? '';

const customFetch = async (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        return response;
    } catch (err) {
        throw new Error('SUPABASE_NETWORK_ERROR');
    }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: { fetch: customFetch },
});

export const isSupabaseReachable = () => true;
export const isSchemaDeployed = () => true;

export function markSchemaMissing(): void {}

export function resetSupabaseReachability(): void {}