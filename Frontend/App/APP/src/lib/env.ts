/**
 * Frontend environment access.
 * MongoDB credentials stay on the backend only; the browser talks to the API.
 */

interface EnvConfig {
  API_URL: string;
  API_BASE_URL: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_MESSAGING_SENDER_ID?: string;
  FIREBASE_APP_ID?: string;
  FIREBASE_AUTH_DOMAIN?: string;
  FIREBASE_STORAGE_BUCKET?: string;
  FIREBASE_VAPID_KEY?: string;
  GROQ_API_KEY?: string;
  DAILY_API_KEY?: string;
}

function validateEnv(): EnvConfig {
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000';

  const config: EnvConfig = {
    API_BASE_URL: apiBaseUrl,
    API_URL: apiBaseUrl,
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

  const optional = ['FIREBASE_API_KEY', 'GROQ_API_KEY', 'DAILY_API_KEY'] as const;
  const missingOptional = optional.filter((key) => !config[key]);

  if (missingOptional.length > 0 && import.meta.env.DEV) {
    console.info(
      `[Smart Care Hub] Optional features disabled:\n` +
        missingOptional
          .map((key) => {
            if (key === 'FIREBASE_API_KEY') return '  - Push notifications (VITE_FIREBASE_*)';
            if (key === 'GROQ_API_KEY') return '  - AI insights (VITE_GROQ_API_KEY)';
            if (key === 'DAILY_API_KEY') return '  - Video consultations (VITE_DAILY_API_KEY)';
            return `  - ${key}`;
          })
          .join('\n'),
    );
  }

  return config;
}

export const env = validateEnv();

export const isFeatureEnabled = {
  database: Boolean(env.API_BASE_URL),
  firebase: Boolean(env.FIREBASE_API_KEY && env.FIREBASE_PROJECT_ID),
  groqAI: Boolean(env.GROQ_API_KEY),
  videoConsultation: Boolean(env.DAILY_API_KEY),
};
