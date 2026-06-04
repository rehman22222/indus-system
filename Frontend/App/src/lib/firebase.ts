import type { FirebaseApp } from 'firebase/app';
import type { Messaging, MessagePayload, Unsubscribe } from 'firebase/messaging';

/**
 * Firebase Cloud Messaging — lazy, env-gated initialization.
 *
 * Initialization runs on the FIRST call to a getter, never at module
 * load time. If any required env var is missing the getters return
 * `null` and the public helpers degrade to no-ops, so importing this
 * module can never crash the app.
 */

interface FirebaseEnv {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
}

function readFirebaseEnv(): FirebaseEnv | null {
    const cfg = {
        apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    };

    for (const v of Object.values(cfg)) {
        if (!v || typeof v !== 'string') return null;
    }
    return cfg as FirebaseEnv;
}

// Memoized state — `undefined` means "not yet attempted",
// `null` means "attempted and unavailable".
let cachedApp: FirebaseApp | null | undefined;
let cachedMessaging: Messaging | null | undefined;

export async function getFirebaseApp(): Promise<FirebaseApp | null> {
    if (cachedApp !== undefined) return cachedApp;

    const cfg = readFirebaseEnv();
    if (!cfg) {
        cachedApp = null;
        return null;
    }

    try {
        const { initializeApp, getApps, getApp } = await import('firebase/app');
        cachedApp = getApps().length > 0 ? getApp() : initializeApp(cfg);
        return cachedApp;
    } catch (err) {
        console.warn('[firebase] initializeApp failed; FCM disabled:', err);
        cachedApp = null;
        return null;
    }
}

export async function getMessagingInstance(): Promise<Messaging | null> {
    if (cachedMessaging !== undefined) return cachedMessaging;

    const app = await getFirebaseApp();
    if (!app) {
        cachedMessaging = null;
        return null;
    }

    // Browser-only API. Bail in any non-browser context.
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        cachedMessaging = null;
        return null;
    }

    try {
        const { getMessaging, isSupported } = await import('firebase/messaging');
        if (!(await isSupported())) {
            cachedMessaging = null;
            return null;
        }
        cachedMessaging = getMessaging(app);
        return cachedMessaging;
    } catch (err) {
        console.warn('[firebase] getMessaging failed; FCM disabled:', err);
        cachedMessaging = null;
        return null;
    }
}

export async function requestNotificationPermission(): Promise<string | null> {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    if (typeof Notification === 'undefined') return null;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return null;

        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) return null;

        const { getToken } = await import('firebase/messaging');
        return await getToken(messaging, { vapidKey });
    } catch (err) {
        console.warn('[firebase] requestNotificationPermission failed:', err);
        return null;
    }
}

const NOOP_UNSUBSCRIBE: Unsubscribe = () => { /* messaging unavailable */ };

export function onForegroundMessage(callback: (payload: MessagePayload) => void): Unsubscribe {
    // Synchronous return contract: callers store the unsubscribe immediately.
    // Resolve messaging in the background and only wire the listener if it
    // becomes available; otherwise the caller's unsubscribe is a no-op.
    let realUnsubscribe: Unsubscribe | null = null;
    let cancelled = false;

    void (async () => {
        const messaging = await getMessagingInstance();
        if (!messaging || cancelled) return;
        try {
            const { onMessage } = await import('firebase/messaging');
            realUnsubscribe = onMessage(messaging, callback);
        } catch (err) {
            console.warn('[firebase] onMessage subscription failed:', err);
        }
    })();

    return () => {
        cancelled = true;
        if (realUnsubscribe) realUnsubscribe();
        else NOOP_UNSUBSCRIBE();
    };
}
