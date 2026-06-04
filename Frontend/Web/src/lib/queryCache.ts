/**
 * In-memory query cache for frequently accessed data
 * Reduces redundant API calls and improves performance
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data if it exists and hasn't expired
 * @param key Cache key
 * @returns Cached data or null if not found/expired
 */
export function getCached<T>(key: string): T | null {
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

/**
 * Store data in cache with TTL
 * @param key Cache key
 * @param data Data to cache
 * @param ttlMs Time to live in milliseconds
 */
export function setCached<T>(key: string, data: T, ttlMs: number): void {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
    });
}

/**
 * Invalidate a specific cache entry
 * @param key Cache key to invalidate
 */
export function invalidateCache(key: string): void {
    cache.delete(key);
}

/**
 * Invalidate all cache entries matching a prefix
 * @param prefix Key prefix to match
 */
export function invalidateCacheByPrefix(prefix: string): void {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
    cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    return {
        size: cache.size,
        keys: Array.from(cache.keys()),
    };
}

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
    DOCTORS: 5 * 60 * 1000,           // 5 minutes - changes rarely
    DEPARTMENTS: 10 * 60 * 1000,      // 10 minutes - almost never changes
    SLOTS: 30 * 1000,                 // 30 seconds - can change when booking
    DAILY_STATS: 60 * 1000,           // 1 minute - acceptable staleness
    PATIENT_PROFILE: 2 * 60 * 1000,   // 2 minutes
    DOCTOR_PROFILE: 5 * 60 * 1000,    // 5 minutes
} as const;
