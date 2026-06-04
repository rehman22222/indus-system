// Firebase Cloud Messaging Service Worker
// This runs in the background to handle push notifications when the app is closed

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase configuration (injected at build time or set manually)
const firebaseConfig = {
    apiKey: self.VITE_FIREBASE_API_KEY || '',
    authDomain: self.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: self.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: self.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: self.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: self.VITE_FIREBASE_APP_ID || '',
};

// Initialize Firebase only if config is available
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);

        const notificationTitle = payload.notification?.title || 'Smart Care Hub';
        const notificationOptions = {
            body: payload.notification?.body || '',
            icon: '/favicon.svg',
            badge: '/favicon.svg',
            data: payload.data || {},
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
}
