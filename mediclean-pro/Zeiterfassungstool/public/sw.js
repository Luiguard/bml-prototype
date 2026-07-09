const CACHE_NAME = 'zeit-v1';
const OFFLINE_QUEUE_NAME = 'zeit-offline-queue';

const STATIC_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method === 'POST' && request.url.includes('/api/time-entries')) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        const body = await request.clone().json();
        await saveToOfflineQueue(body);
        return new Response(
          JSON.stringify({ success: true, offline: true, message: 'Offline gespeichert – wird synchronisiert.' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  if (request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-time-entries') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function saveToOfflineQueue(entry) {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
  tx.objectStore(OFFLINE_QUEUE_NAME).add({ ...entry, queuedAt: new Date().toISOString() });
}

async function syncOfflineQueue() {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE_NAME, 'readwrite');
  const store = tx.objectStore(OFFLINE_QUEUE_NAME);
  const entries = await getAllFromStore(store);

  for (const entry of entries) {
    try {
      await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, offlineSync: true }),
      });
      store.delete(entry.id);
    } catch {
      break;
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ZeiterfassungOffline', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_NAME)) {
        db.createObjectStore(OFFLINE_QUEUE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore(store) {
  return new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve([]);
  });
}
