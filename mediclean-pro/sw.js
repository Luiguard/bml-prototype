const CACHE_NAME = 'mediclean-pro-v37';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './portal/employee_dashboard.html',
    './portal/customer_dashboard.html',
    './ueber-uns.html',
    './service.html',
    './consulting.html',
    './termin.html',
    './impressum.html',
    './datenschutz.html',
    './agb.html',
    './customer_login.html',
    './login.html',
    './css/style.v3.css',
    './css/responsive_auth.css',
    './js/toast.js',
    './js/script.js',
    './js/auth.js',
    './js/filesystem.js',
    './js/security.js',
    './js/consent.js',
    './js/pwa-handler.js',
    './js/accessibility.js',
    './images/Logp_PNG_T_G-1-scaled-re4kdagvxjw3jm126h9ba72rackqddmigpofo0piwc.png',
    './favicon.svg',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install Event: Cache Core Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching core assets');
            // Using map to cache individually so one error doesn't kill it all
            return Promise.allSettled(
                ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn(`Failed to cache: ${url}`, err)))
            );
        })
    );
    self.skipWaiting(); // Force active immediately
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => {
            // This ensures that the service worker takes control of the page immediately after activation.
            // It's important for the "stale-while-revalidate" strategy to work correctly on the first load after an update.
            return self.clients.claim();
        })
    );
});

// Fetch Event: Network-First for HTML, Stale-While-Revalidate for Assets
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // API calls or non-GET requests: never cache
    if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
        return;
    }

    const isHTMLRequest = event.request.headers.get('accept') &&
        event.request.headers.get('accept').includes('text/html');

    if (isHTMLRequest) {
        // Network-First für HTML: immer aktuelle Version laden
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => caches.match(event.request)) // Fallback auf Cache wenn offline
        );
    } else {
        // Stale-While-Revalidate für CSS/JS/Bilder
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return networkResponse;
                    })
                    .catch((err) => {
                        console.warn('[Service Worker] Fetch failed:', err);
                        return cachedResponse; // Silently fallback to cache
                    });
                return cachedResponse || fetchPromise;
            })
        );
    }
});
// --- Push Notification Event (Background) ---
self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push Received.');
    let data = { title: 'MediClean Pro Task', body: 'Neue Aufgabe verfügbar!', url: './portal/employee_dashboard.html' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: 'images/20260108_114357-1024x1024.png',
        badge: 'images/20260108_114357-1024x1024.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || './portal/employee_dashboard.html'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// --- Notification Click Handling ---
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If already open, focus it
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url || './portal/employee_dashboard.html');
            }
        })
    );
});
