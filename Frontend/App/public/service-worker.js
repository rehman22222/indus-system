// No-op service worker for development
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (event) => {
    // Pass through all requests
    event.respondWith(fetch(event.request));
});
