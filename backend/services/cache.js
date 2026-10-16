// Minimal in-memory TTL cache for hot, rarely-changing read routes.
// Optional: set CACHE_ENABLED=false to bypass entirely (e.g. multiple instances).

const ENABLED = process.env.CACHE_ENABLED !== 'false';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

const store = new Map();

const getOrSet = async (key, fetcher, ttl = DEFAULT_TTL) => {
    if (!ENABLED) return fetcher();
    const cached = store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }
    const value = await fetcher();
    store.set(key, { value, expiresAt: Date.now() + ttl });
    return value;
};

const get = (key) => {
    if (!ENABLED) return undefined;
    const cached = store.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }
    if (cached) store.delete(key);
    return undefined;
};

const set = (key, value, ttl = DEFAULT_TTL) => {
    if (!ENABLED) return;
    store.set(key, { value, expiresAt: Date.now() + ttl });
};

// Remove all keys matching a prefix (call after writes).
const invalidate = (prefix) => {
    if (!ENABLED) return;
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
    }
};

const clear = () => store.clear();

// Prevent unbounded growth: periodic sweep of expired entries.
const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (entry.expiresAt <= now) store.delete(key);
    }
}, 5 * 60 * 1000);
if (typeof sweeper.unref === 'function') sweeper.unref();

module.exports = { get, getOrSet, set, invalidate, clear };