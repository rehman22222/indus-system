/**
 * Firebase Cloud Messaging (push) service.
 *
 * Centralizes Firebase Admin initialization and message delivery so both the
 * notification controller and the background notification worker share one
 * initialized app and one code path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let firebaseInitialized = false;

/**
 * Resolve Firebase Admin credentials from, in order of preference:
 *   1. A service-account JSON file (FIREBASE_SERVICE_ACCOUNT or
 *      GOOGLE_APPLICATION_CREDENTIALS) — the recommended, escape-free option.
 *   2. Individual FCM_* env vars (private key with literal \n sequences).
 */
function resolveServiceAccount() {
    const configuredPath =
        process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (configuredPath) {
        const absolute = path.isAbsolute(configuredPath)
            ? configuredPath
            : path.resolve(BACKEND_ROOT, configuredPath);
        if (fs.existsSync(absolute)) {
            const json = JSON.parse(fs.readFileSync(absolute, 'utf8'));
            return {
                projectId: json.project_id,
                clientEmail: json.client_email,
                privateKey: json.private_key,
            };
        }
        console.warn(`Firebase service account file not found at ${absolute}`);
    }

    if (process.env.FCM_PROJECT_ID && process.env.FCM_PRIVATE_KEY) {
        return {
            projectId: process.env.FCM_PROJECT_ID,
            clientEmail: process.env.FCM_CLIENT_EMAIL,
            privateKey: process.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
    }

    return null;
}

export function initPush() {
    if (firebaseInitialized) return true;

    const serviceAccount = resolveServiceAccount();
    if (!serviceAccount) {
        console.log('Firebase Cloud Messaging disabled (no credentials)');
        return false;
    }

    try {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        firebaseInitialized = true;
        console.log(`Firebase Admin initialized (project: ${serviceAccount.projectId})`);
    } catch (error) {
        console.warn('Firebase Admin initialization failed (FCM disabled):', error.message);
    }
    return firebaseInitialized;
}

export function isPushReady() {
    return firebaseInitialized;
}

function stringifyData(data = {}) {
    // FCM requires all data values to be strings.
    const out = {};
    for (const [key, value] of Object.entries(data)) {
        out[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return out;
}

export async function sendPushToToken(token, { title, body, data = {} }) {
    if (!firebaseInitialized) throw new Error('Push service is not configured');

    return admin.messaging().send({
        notification: { title, body },
        data: stringifyData({ ...data, timestamp: new Date().toISOString() }),
        token,
    });
}

export async function sendPushToTokens(tokens, { title, body, data = {} }) {
    if (!firebaseInitialized) throw new Error('Push service is not configured');
    if (!Array.isArray(tokens) || tokens.length === 0) {
        return { successCount: 0, failureCount: 0, responses: [] };
    }

    return admin.messaging().sendEachForMulticast({
        notification: { title, body },
        data: stringifyData({ ...data, timestamp: new Date().toISOString() }),
        tokens,
    });
}

export function pushStatus() {
    return { ready: firebaseInitialized };
}

// Initialize on import so status is correct even before the first send.
initPush();
