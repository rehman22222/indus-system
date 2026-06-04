// Service Worker for Smart Care Hub PWA
// Implements offline-first caching strategy with cache versioning

const CACHE_VERSION = 'v1';
const CACHE_NAME = `smart-care-hub-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/favicon.svg',
    '/placeholder.svg',
    '/robots.txt',
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => {
            console.log('[Service Worker] Installed successfully');
            return self.skipWaiting();
        })
    );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Activated successfully');
            return self.clients.claim();
        })
    );
});

// Fetch event: network-first strategy for API calls, cache-first for assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Network-first strategy for API calls (Supabase, Edge Functions)
    if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone response before caching
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    return caches.match(request).then((cachedResponse) => {
                        return cachedResponse || new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable',
                        });
                    });
                })
        );
        return;
    }

    // Cache-first strategy for static assets (JS, CSS, images, fonts)
    if (
        url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/)
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then((response) => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                });
            })
        );
        return;
    }

    // Network-first for HTML pages
    event.respondWith(
        fetch(request)
            .then((response) => {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseClone);
                });
                return response;
            })
            .catch(() => {
                return caches.match(request).then((cachedResponse) => {
                    return cachedResponse || caches.match('/index.html');
                });
            })
    );
});

// Message event: handle cache clearing from client
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('[Service Worker] All caches cleared');
                event.ports[0].postMessage({ success: true });
            })
        );
    }
});
