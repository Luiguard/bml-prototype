const CACHE_NAME = 'bweb-cache-v1';
const BWEB_ASSETS = [
    '/',
    '/index.html',
    '/server.py' // Just to illustrate caching, though server is backend
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(BWEB_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Cache-First strategy for .bweb files
    if (url.pathname.endsWith('.bweb') || url.pathname.endsWith('.bml')) {
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    // Update cache in background (Stale-While-Revalidate pattern for binary files)
                    fetch(event.request).then(networkResponse => {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }).catch(() => {});
                    return cachedResponse;
                }
                return fetch(event.request).then(networkResponse => {
                    const cloned = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, cloned);
                    });
                    return networkResponse;
                });
            })
        );
        return;
    }

    // Default Network-First for other assets
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
