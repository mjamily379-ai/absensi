// frontend/public/service-worker.js
// PWA service worker: network-first navigation, stale-while-revalidate assets,
// offline clock-in/out queue replay (background sync), and notification routing.

const PRECACHE_NAME = 'absen-najiyah-precache-v2';
const ASSET_CACHE_NAME = 'absen-najiyah-assets-v2';
const OFFLINE_DB = 'absen-pwa';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE = 'offline-requests';
const SYNC_TAG = 'clock';

// The app shell. Navigation requests (index.html / SPA route fallback) are
// network-first, so these only come into play while offline.
const PRECACHE_ASSETS = [
  '/index.html',
  '/manifest.json',
  '/LOGO1.png'
];

// ---------------------------------------------------------------------------
// Install / activate with versioned caches
// ---------------------------------------------------------------------------

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('Precaching skipped:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          // Keep only the current versioned caches; the old unversioned
          // 'absen-najiyah-cache-v1' (and any previous iterations) is dropped.
          .filter(name => name !== PRECACHE_NAME && name !== ASSET_CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch: network-first for the shell, stale-while-revalidate for assets
// ---------------------------------------------------------------------------

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Cross-origin (Google Fonts, etc.) — let the browser handle it directly.
    return;
  }

  if (request.mode === 'navigate') {
    // Network-first for index.html + the SPA template so app updates are not
    // stuck behind a static cache-first entry.
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(PRECACHE_NAME)
            .then(cache => cache.put('/index.html', clone))
            .catch(() => {});
          return networkResponse;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Images, fonts, CSS, JS, manifest, etc. — stale-while-revalidate.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(ASSET_CACHE_NAME)
              .then(cache => cache.put(request, clone))
              .catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ---------------------------------------------------------------------------
// Offline request queue: replay on background sync or on client request.
// This is the single writer for the IndexedDB 'offline-requests' store.
// ---------------------------------------------------------------------------

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    if (!self.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = self.indexedDB.open(OFFLINE_DB, OFFLINE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        const store = db.createObjectStore(OFFLINE_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllOfflineRequests() {
  return openOfflineDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readonly');
    const request = tx.objectStore(OFFLINE_STORE).getAll();
    request.onsuccess = () => {
      const result = request.result || [];
      db.close();
      resolve(result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  }));
}

function deleteOfflineRequest(id) {
  return openOfflineDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  }));
}

// Replays queued clock-in/out (and Sakit/Izin) requests. Deletes each entry
// only after a successful response; 401/403 means the session/CSRF is gone and
// the entry is dropped to avoid an endless retry loop.
let flushing = false;
async function flushOfflineQueue() {
  // Guard against concurrent triggers (background sync event + client message +
  // reconnect message can all fire in the same window) — one replay is enough.
  if (flushing) return null;
  flushing = true;

  let flushed = 0;
  let failed = 0;
  let remaining = 0;

  try {
    const records = await getAllOfflineRequests();
    remaining = records.length;

    for (const record of records) {
      try {
        const response = await fetch(record.url, {
          method: record.method,
          headers: record.headers || {},
          body: record.body,
          credentials: 'include'
        });

        if (response.status === 401 || response.status === 403) {
          await deleteOfflineRequest(record.id);
          failed += 1;
        } else if (response.ok) {
          await deleteOfflineRequest(record.id);
          flushed += 1;
        } else {
          failed += 1;
          break;
        }
      } catch (err) {
        // Still offline — stop and let a later sync event pick it up again.
        failed += 1;
        break;
      }
    }
  } catch (err) {
    console.warn('flushOfflineQueue failed:', err);
  } finally {
    flushing = false;
  }

  const result = { type: 'OFFLINE_QUEUE_FLUSHED', flushed, failed, remaining };
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientList.forEach(client => client.postMessage(result));
  return result;
}

self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushOfflineQueue());
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'FLUSH_OFFLINE_QUEUE') {
    event.waitUntil(flushOfflineQueue());
  }
});

// ---------------------------------------------------------------------------
// Push notifications + deep-linking
// ---------------------------------------------------------------------------

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data.json();
  } catch (err) {
    data = { title: 'Absensi Annajiyah', body: event.data ? event.data.text() : 'Ada pembaruan dari sistem absensi.' };
  }

  const options = {
    body: data.body || 'Ada pembaruan dari sistem absensi.',
    icon: data.icon || '/LOGO1.png',
    badge: data.badge || '/LOGO1.png',
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Absensi Annajiyah', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  // Deep-link: pay attention to the sender-defined route (data.url) instead of
  // always dropping the user at '/'.
  const data = event.notification.data || {};
  let path = data.url || '/';
  if (path.charAt(0) !== '/') path = '/' + path;
  const urlToOpen = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (new URL(client.url).origin === self.location.origin) {
            return client.navigate(urlToOpen).then(() => client.focus()).catch(() => client.focus());
          }
        }
        return self.clients.openWindow(urlToOpen);
      })
  );
});