import axios from 'axios';
import { enqueueOfflineRequest } from './pwa/offlineQueue';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL,
    withCredentials: true, // Crucial for sending/receiving cookies (JWT + CSRF)
});

// Read a cookie by name (JS-readable cookies only, HTTP-only ones are excluded)
const getCookie = (name: string): string | undefined => {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : undefined;
};

// Attach the double-submit CSRF token header on state-changing requests
const SAFE_METHODS = ['get', 'head', 'options'];
api.interceptors.request.use((config) => {
    if (!SAFE_METHODS.includes((config.method || 'get').toLowerCase())) {
        const csrfToken = getCookie('csrf');
        if (csrfToken) {
            config.headers['x-csrf-token'] = csrfToken;
        }
    }
    return config;
});

// Offline mode: only state-changing attendance writes (clock-in/out, Sakit/Izin
// reports) are worth keeping. Reads are best-effort and can be retried manually.
const OFFLINE_QUEUEABLE_PATHS = ['/api/records', '/api/attendance'];
const isQueueableOfflineRequest = (config: any): boolean => {
    const method = (config.method || 'get').toLowerCase();
    if (SAFE_METHODS.includes(method)) return false;
    const url = config.url || '';
    return OFFLINE_QUEUEABLE_PATHS.some((path) => url.startsWith(path) || url.includes(path));
};

// Handle 401 errors (session expired / token revoked) + the offline write queue.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        // Session invalidated — this must work identically in a standalone PWA
        // window and a normal browser tab.
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }

        // Network failure while trying to clock in/out: persist locally and let
        // the service worker replay it via background sync when online again.
        if (!error.response && error.config && isQueueableOfflineRequest(error.config)) {
            const csrfToken = getCookie('csrf');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (csrfToken) headers['x-csrf-token'] = csrfToken;
            try {
                const fullUrl = new URL(error.config.url, api.defaults.baseURL || window.location.origin).toString();
                await enqueueOfflineRequest({
                    url: fullUrl,
                    method: (error.config.method || 'post').toUpperCase(),
                    headers,
                    body: error.config.data ? JSON.stringify(error.config.data) : undefined,
                });
                error.offlineQueued = true;
            } catch (queueError) {
                console.warn('Failed to queue request for offline sync:', queueError);
            }
        }
        return Promise.reject(error);
    }
);

// Build an absolute URL for server-served assets (e.g. "/api/leave-requests/:id/attachment").
// Mirrors the pattern used in AdminDashboard for record photos.
export const resolveApiUrl = (path?: string): string => {
  if (!path) return '';
  if (/^https?:\/\//.test(path) || path.startsWith('data:')) return path;
  const base = process.env.REACT_APP_API_URL || '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Download a server-hosted attachment and expose it as a same-origin blob URL.
 *
 * Pointing <img>/<iframe> straight at the API host does not work once the app and
 * the API live on different subdomains: the API answers with helmet's default
 * `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`, and the app page CSP
 * allows 'self' only, so the browser refuses the request. Going through the
 * authenticated axios instance (withCredentials) sidesteps both and also lets us
 * surface real 401/404 errors instead of an empty frame.
 *
 * Callers must revoke the returned URL with URL.revokeObjectURL when done.
 */
export const fetchAttachmentBlobUrl = async (path: string, signal?: AbortSignal): Promise<{ url: string; mime: string }> => {
  // Legacy rows still hold a base64 data URI — usable directly, no fetch needed.
  if (path.startsWith('data:')) {
    return { url: path, mime: path.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream' };
  }

  const response = await api.get(resolveApiUrl(path), { responseType: 'blob', signal });
  const mime = (response.headers?.['content-type'] as string) || 'application/octet-stream';
  return { url: URL.createObjectURL(new Blob([response.data], { type: mime })), mime };
};

export default api;
