import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress backend-network errors in console during local development.
// We can't stop the browser from logging the underlying failed fetch /
// WebSocket connect (those happen below the JS layer), but we can silence
// the app-level console.error / console.warn that pile on top.
const MongoDB_NOISE_PATTERNS = [
    'ERR_NAME_NOT_RESOLVED',
    'MongoDB_UNREACHABLE',
    'MongoDB_NOT_CONFIGURED',
    'MongoDB_SCHEMA_MISSING',
    'Failed to fetch',
    'NetworkError',
    // PostgREST error codes / messages — surface when the project schema
    // is missing or partial. App falls back to mock data; the noise is
    // not actionable for users.
    'PGRST',
    'schema cache',
    'Could not find the table',
    'Could not find a relationship',
];

function flatten(arg: unknown): string {
    if (arg == null) return '';
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    if (typeof arg === 'object') {
        const obj = arg as Record<string, unknown>;
        const fields = ['message', 'details', 'hint', 'code', 'reason'];
        const parts = fields
            .map((k) => obj[k])
            .filter((v): v is string => typeof v === 'string');
        if (parts.length) return parts.join(' ');
        try { return JSON.stringify(arg); } catch { return String(arg); }
    }
    return String(arg);
}

function isMongoDBNoise(args: unknown[]): boolean {
    const flat = args.map(flatten).join(' ');
    return MongoDB_NOISE_PATTERNS.some((p) => flat.includes(p));
}

// Only mute in development. In production we leave console.error/warn intact so
// error-monitoring tooling (and genuine bugs) are never silently swallowed.
if (import.meta.env.DEV) {
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
        if (isMongoDBNoise(args)) return;
        originalConsoleError.apply(console, args as never[]);
    };

    const originalConsoleWarn = console.warn;
    console.warn = (...args: unknown[]) => {
        if (isMongoDBNoise(args)) return;
        originalConsoleWarn.apply(console, args as never[]);
    };
}

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker in production only
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/service-worker.js')
            .then((registration) => {
                console.log('[PWA] Service Worker registered:', registration.scope);
            })
            .catch((error) => {
                console.error('[PWA] Service Worker registration failed:', error);
            });
    });
}

