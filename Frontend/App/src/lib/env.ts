/**
 * Environment variable validation
 * Validates required env vars at startup and provides typed access
 */

interface EnvConfig {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    API_URL: string;
    FIREBASE_API_KEY: string;
    FIREBASE_PROJECT_ID: string;
    FIREBASE_MESSAGING_SENDER_ID: string;
    FIREBASE_APP_ID: string;
    FIREBASE_AUTH_DOMAIN: string;
    FIREBASE_STORAGE_BUCKET: string;
    FIREBASE_VAPID_KEY: string;
    GROQ_API_KEY: string;
    DAILY_API_KEY: string;
}

function validateEnv(): Partial<EnvConfig> {
    const config = {
        SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
        API_URL: import.meta.env.VITE_API_URL,
        FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
        FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
        FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        FIREBASE_VAPID_KEY: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        GROQ_API_KEY: import.meta.env.VITE_GROQ_API_KEY,
        DAILY_API_KEY: import.meta.env.VITE_DAILY_API_KEY,
    };

    // Required for core functionality
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const;

    const missing = required.filter(
        (key) => !config[key] || config[key] === 'undefined' || config[key] === ''
    );

    if (missing.length > 0) {
        // In development: warn loudly but allow mock-data fallback
        if (import.meta.env.DEV) {
            console.warn(
                `[Smart Care Hub] Missing required env vars — app will run in OFFLINE/MOCK mode:\n` +
                missing.map(k => `  - VITE_${k}`).join('\n') +
                `\n\nCopy .env.example to .env and fill in your values.`
            );
        } else {
            // In production: throw so deployment fails fast
            throw new Error(
                `[Smart Care Hub] FATAL: Missing required env vars:\n` +
                missing.map(k => `  - VITE_${k}`).join('\n') +
                `\n\nCheck your .env file and rebuild.`
            );
        }
    }

    // Optional features - warn if missing but don't block
    const optional = ['FIREBASE_API_KEY', 'GROQ_API_KEY', 'DAILY_API_KEY'] as const;
    const missingOptional = optional.filter(
        (key) => !config[key] || config[key] === 'undefined' || config[key] === ''
    );

    if (missingOptional.length > 0 && import.meta.env.DEV) {
        console.info(
            `[Smart Care Hub] Optional features disabled (missing env vars):\n` +
            missingOptional.map(k => {
                if (k === 'FIREBASE_API_KEY') return '  - Push notifications (VITE_FIREBASE_*)';
                if (k === 'GROQ_API_KEY') return '  - AI insights (VITE_GROQ_API_KEY)';
                if (k === 'DAILY_API_KEY') return '  - Video consultations (VITE_DAILY_API_KEY)';
                return `  - ${k}`;
            }).join('\n')
        );
    }

    return config;
}

export const env = validateEnv();

// Helper to check if a feature is enabled
export const isFeatureEnabled = {
    supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
    firebase: Boolean(env.FIREBASE_API_KEY && env.FIREBASE_PROJECT_ID),
    groqAI: Boolean(env.GROQ_API_KEY),
    videoConsultation: Boolean(env.DAILY_API_KEY),
};
