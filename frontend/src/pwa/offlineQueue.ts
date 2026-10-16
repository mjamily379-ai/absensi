// frontend/src/pwa/offlineQueue.ts
// IndexedDB-backed offline request queue + background sync orchestration.
//
// The service worker (public/service-worker.js) is the single writer that
// replays queued requests (on the 'clock' background sync tag and on an
// explicit FLUSH_OFFLINE_QUEUE message). This module is the client-side
// counterpart: it enqueues requests while offline and asks the SW to flush
// as soon as connectivity comes back.

const DB_NAME = 'absen-pwa';
const DB_VERSION = 1;
const OFFLINE_STORE = 'offline-requests';
const SYNC_TAG = 'clock';

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
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

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

// Register a one-off background sync that the SW turns into a flush when the
// connection comes back. Re-registering the same tag is the supported pattern
// (each offline episode gets its own sync).
async function registerBackgroundSync(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const swRegistration = registration as unknown as {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (swRegistration.sync && swRegistration.sync.register) {
      await swRegistration.sync.register(SYNC_TAG);
    }
  } catch (error) {
    console.warn('Background sync registration failed:', error);
  }
}

export async function enqueueOfflineRequest(
  request: Omit<QueuedRequest, 'id' | 'createdAt'>
): Promise<void> {
  const db = await openDB();
  try {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).add({ ...request, createdAt: Date.now() });
    await txDone(tx);
  } finally {
    db.close();
  }
  await registerBackgroundSync();
}

export async function getOfflineQueueSize(): Promise<number> {
  const db = await openDB();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE, 'readonly');
      const request = tx.objectStore(OFFLINE_STORE).count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// Ask the service worker (the single writer) to replay the queue. Safe to
// call on every reconnect — the SW is idempotent (entries are deleted only
// after a successful request), unrelated to whether a sync tag fires.
export async function requestOfflineFlush(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    await registerBackgroundSync();
    if (registration.active) {
      registration.active.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' });
    }
  } catch (error) {
    console.warn('Failed to request offline flush:', error);
  }
}

// Install the online/reconnect + SW message wiring. Returns a cleanup fn.
export function initOfflineSupport(): () => void {
  const handleOnline = () => {
    requestOfflineFlush();
  };

  const handleMessage = (event: MessageEvent) => {
    const data = event.data || (event as any).data;
    if (data && data.type === 'OFFLINE_QUEUE_FLUSHED') {
      window.dispatchEvent(
        new CustomEvent('offline-queue-flushed', { detail: data })
      );
    }
  };

  window.addEventListener('online', handleOnline);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleMessage);
  }

  // Flush anything left from a previous offline session once we start up.
  if (navigator.onLine) {
    requestOfflineFlush();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  };
}