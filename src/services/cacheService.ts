/**
 * CacheService — Unified in-memory + localStorage cache with TTL
 *
 * Namespaces:
 *  'freight'  → TTL 12h  (BNSF tariff rates, keyed by state::city)
 *  'market'   → TTL 30m  (futures price per crop)
 *  'usda'     → TTL 60m  (USDA regional basis adjustments)
 *  'oracle'   → TTL 60m  (Gemini market oracle per crop)
 *  'buyers'   → TTL 30m  (fully-computed buyer list per crop)
 */

interface CacheEntry<T> {
    value: T;
    storedAt: number; // epoch ms
    ttlMs: number;
}

// In-memory store (L1). localStorage is L2 for persistence.
const memStore: Map<string, CacheEntry<unknown>> = new Map();

const LS_PREFIX = 'ci_cache::';

// Stats per namespace for debugging
const stats: Record<string, { hits: number; misses: number }> = {};

function nsKey(namespace: string, key: string): string {
    return `${namespace}::${key}`;
}

function track(namespace: string, hit: boolean) {
    if (!stats[namespace]) stats[namespace] = { hits: 0, misses: 0 };
    if (hit) stats[namespace].hits++;
    else stats[namespace].misses++;
}

function readLS<T>(fullKey: string): CacheEntry<T> | null {
    try {
        const raw = localStorage.getItem(LS_PREFIX + fullKey);
        if (!raw) return null;
        return JSON.parse(raw) as CacheEntry<T>;
    } catch {
        return null;
    }
}

function writeLS<T>(fullKey: string, entry: CacheEntry<T>): void {
    try {
        localStorage.setItem(LS_PREFIX + fullKey, JSON.stringify(entry));
    } catch {
        // localStorage full or unavailable — degrade gracefully
    }
}

function removeLS(fullKey: string): void {
    try {
        localStorage.removeItem(LS_PREFIX + fullKey);
    } catch {
        // ignore
    }
}

export const cacheService = {
    /**
     * Get a cached value.
     * Returns `null` if not found or expired.
     */
    get<T>(namespace: string, key: string): T | null {
        const fullKey = nsKey(namespace, key);

        // L1: memory
        let entry = memStore.get(fullKey) as CacheEntry<T> | undefined;

        // L2: localStorage (cross-session persistence for long-TTL caches like freight)
        if (!entry) {
            const lsEntry = readLS<T>(fullKey);
            if (lsEntry) {
                memStore.set(fullKey, lsEntry); // promote to L1
                entry = lsEntry;
            }
        }

        if (!entry) {
            track(namespace, false);
            return null;
        }

        const age = Date.now() - entry.storedAt;
        if (age > entry.ttlMs) {
            // Expired — evict from both layers
            memStore.delete(fullKey);
            removeLS(fullKey);
            track(namespace, false);
            return null;
        }

        track(namespace, true);
        return entry.value;
    },

    /**
     * Store a value with a TTL.
     */
    set<T>(namespace: string, key: string, value: T, ttlMs: number): void {
        const fullKey = nsKey(namespace, key);
        const entry: CacheEntry<T> = { value, storedAt: Date.now(), ttlMs };
        memStore.set(fullKey, entry);
        writeLS(fullKey, entry);
    },

    /**
     * Invalidate a single key, or an entire namespace (key = undefined).
     */
    invalidate(namespace: string, key?: string): void {
        if (key !== undefined) {
            const fullKey = nsKey(namespace, key);
            memStore.delete(fullKey);
            removeLS(fullKey);
        } else {
            // Clear all keys in namespace from both layers
            const prefix = namespace + '::';
            for (const k of memStore.keys()) {
                if (k.startsWith(prefix)) memStore.delete(k);
            }
            // Scan localStorage
            try {
                const lsKeys: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(LS_PREFIX + prefix)) lsKeys.push(k);
                }
                lsKeys.forEach(k => localStorage.removeItem(k));
            } catch {
                // ignore
            }
        }
    },

    /**
     * Returns the age in ms of a cached entry (regardless of TTL).
     * Returns `null` if the key is not in cache or already expired.
     */
    getAge(namespace: string, key: string): number | null {
        const fullKey = nsKey(namespace, key);
        const entry = memStore.get(fullKey);
        if (!entry) return null;
        const age = Date.now() - entry.storedAt;
        if (age > entry.ttlMs) return null;
        return age;
    },

    /**
     * Returns whether a key is fresh (exists and not expired).
     */
    isFresh(namespace: string, key: string): boolean {
        return this.get(namespace, key) !== null;
    },

    /**
     * Debug: get hit/miss stats per namespace.
     */
    getStats(): Record<string, { hits: number; misses: number; ratio: string }> {
        const result: Record<string, { hits: number; misses: number; ratio: string }> = {};
        for (const [ns, s] of Object.entries(stats)) {
            const total = s.hits + s.misses;
            result[ns] = {
                ...s,
                ratio: total > 0 ? `${Math.round((s.hits / total) * 100)}%` : 'n/a'
            };
        }
        return result;
    }
};

// TTL constants — single source of truth
export const CACHE_TTL = {
    FREIGHT_MS: 12 * 60 * 60 * 1000,   // 12 hours
    MARKET_MS: 30 * 60 * 1000,         // 30 minutes
    USDA_MS: 60 * 60 * 1000,         // 60 minutes
    ORACLE_MS: 60 * 60 * 1000,         // 60 minutes
    BUYERS_MS: 30 * 60 * 1000,         // 30 minutes
} as const;

export type CacheNamespace = 'freight' | 'market' | 'usda' | 'oracle' | 'buyers';
