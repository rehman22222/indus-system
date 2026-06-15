import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

function required(name) {
    const value = process.env[name];
    if (!value || !String(value).trim()) {
        throw new Error(`${name} is required`);
    }
    return String(value).trim();
}

function optional(name, fallback = '') {
    const value = process.env[name];
    return value === undefined || value === null || value === '' ? fallback : String(value).trim();
}

function number(name, fallback, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
    const raw = process.env[name];
    const value = raw === undefined || raw === '' ? fallback : Number(raw);

    if (!Number.isFinite(value) || value < min || value > max) {
        throw new Error(`${name} must be a number between ${min} and ${max}`);
    }

    return value;
}

function bool(name, fallback = false) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

function csv(name, fallback = '') {
    return optional(name, fallback)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

const corsOrigins = [
    ...csv('CORS_ORIGINS'),
    ...csv('CORS_ORIGIN'),
].filter((origin, index, list) => list.indexOf(origin) === index);

if (isProduction && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS is required in production');
}

if (isProduction && corsOrigins.includes('*')) {
    throw new Error('Wildcard CORS is not allowed in production');
}

export const env = Object.freeze({
    NODE_ENV: optional('NODE_ENV', 'development'),
    IS_PRODUCTION: isProduction,
    PORT: number('PORT', 5000, { min: 1, max: 65535 }),
    TRUST_PROXY: bool('TRUST_PROXY', isProduction),

    MONGODB_URI: required('MONGODB_URI'),
    MONGODB_DB_NAME: optional('MONGODB_DB_NAME', 'doctorappointment'),
    MONGODB_AUTO_INDEX: bool('MONGODB_AUTO_INDEX', false),
    MONGODB_ENSURE_INDEXES_ON_STARTUP: bool('MONGODB_ENSURE_INDEXES_ON_STARTUP', false),
    MONGODB_MAX_POOL_SIZE: number('MONGODB_MAX_POOL_SIZE', 50, { min: 1, max: 1000 }),
    MONGODB_MIN_POOL_SIZE: number('MONGODB_MIN_POOL_SIZE', 0, { min: 0, max: 1000 }),
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: number('MONGODB_SERVER_SELECTION_TIMEOUT_MS', 10000, { min: 1000 }),

    JWT_SECRET: required('JWT_SECRET'),
    JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '24h'),

    RATE_LIMIT_WINDOW_MS: number('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
    RATE_LIMIT_MAX_REQUESTS: number('RATE_LIMIT_MAX_REQUESTS', 300, { min: 1 }),
    AUTH_RATE_LIMIT_MAX_REQUESTS: number('AUTH_RATE_LIMIT_MAX_REQUESTS', 30, { min: 1 }),

    CORS_ORIGINS: corsOrigins,
    ANALYTICS_API_URL: optional('ANALYTICS_API_URL', 'http://localhost:8000'),

    // Appointment-scoped browser WebRTC is the default. Jitsi and Daily are
    // retained as optional fallbacks for existing deployments.
    VIDEO_PROVIDER: optional('VIDEO_PROVIDER', 'webrtc').toLowerCase(),
    CALL_WEB_BASE_URL: optional('CALL_WEB_BASE_URL', 'http://localhost:5173'),
    DOCTOR_CALL_WEB_BASE_URL: optional('DOCTOR_CALL_WEB_BASE_URL', optional('CALL_WEB_BASE_URL', 'http://localhost:5173')),
    PATIENT_CALL_WEB_BASE_URL: optional('PATIENT_CALL_WEB_BASE_URL', optional('CALL_WEB_BASE_URL', 'http://localhost:5173')),
    JITSI_BASE_URL: optional('JITSI_BASE_URL', 'https://meet.jit.si'),

    // Agora RTC (token-based). App ID is public (sent to clients); the App
    // Certificate is secret and only used server-side to sign tokens.
    AGORA_APP_ID: optional('AGORA_APP_ID', ''),
    AGORA_APP_CERTIFICATE: optional('AGORA_APP_CERTIFICATE', ''),
    AGORA_TOKEN_TTL_SECONDS: number('AGORA_TOKEN_TTL_SECONDS', 3600, { min: 60, max: 86400 }),

    REDIS_URL: optional('REDIS_URL', ''),
    SOCKET_IO_REDIS_URL: optional('SOCKET_IO_REDIS_URL', optional('REDIS_URL', '')),
    CACHE_ENABLED: bool('CACHE_ENABLED', true),
    CACHE_DEFAULT_TTL_SECONDS: number('CACHE_DEFAULT_TTL_SECONDS', 60, { min: 1, max: 86400 }),

    // Horizontal/vertical scaling and process management.
    // Running `node src/cluster.js` forks one worker per CPU core (or
    // WEB_CONCURRENCY workers). Set WEB_CONCURRENCY=1 to force a single worker.
    // With >1 worker, set SOCKET_IO_REDIS_URL so realtime events propagate
    // across workers.
    WEB_CONCURRENCY: number('WEB_CONCURRENCY', 0, { min: 0, max: 128 }),

    // Tuned for load balancers / keep-alive reuse under high concurrency.
    // keepAliveTimeout must be < headersTimeout to avoid race-y 502s behind proxies.
    SERVER_KEEP_ALIVE_TIMEOUT_MS: number('SERVER_KEEP_ALIVE_TIMEOUT_MS', 65000, { min: 1000 }),
    SERVER_HEADERS_TIMEOUT_MS: number('SERVER_HEADERS_TIMEOUT_MS', 66000, { min: 1000 }),
    SERVER_REQUEST_TIMEOUT_MS: number('SERVER_REQUEST_TIMEOUT_MS', 30000, { min: 0 }),
    SHUTDOWN_TIMEOUT_MS: number('SHUTDOWN_TIMEOUT_MS', 15000, { min: 1000 }),
});
