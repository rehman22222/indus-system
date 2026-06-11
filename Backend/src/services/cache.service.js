import { createClient } from 'redis';
import { env } from '../config/env.js';

const memoryCache = new Map();
let redisClient;
let redisReady = false;

function now() {
    return Date.now();
}

function memoryGet(key) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now()) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value;
}

function memorySet(key, value, ttlSeconds) {
    memoryCache.set(key, {
        value,
        expiresAt: now() + ttlSeconds * 1000,
    });
}

export async function initCache() {
    if (!env.CACHE_ENABLED || !env.REDIS_URL || redisClient) return;

    redisClient = createClient({ url: env.REDIS_URL });
    redisClient.on('error', (error) => {
        redisReady = false;
        console.warn('Redis cache unavailable:', error.message);
    });

    try {
        await redisClient.connect();
        redisReady = true;
        console.log('Redis cache connected');
    } catch (error) {
        redisReady = false;
        console.warn('Redis cache disabled:', error.message);
    }
}

export async function disconnectCache() {
    if (redisClient?.isOpen) await redisClient.quit();
    redisReady = false;
}

export async function getCache(key) {
    if (!env.CACHE_ENABLED) return null;

    if (redisReady) {
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
    }

    return memoryGet(key);
}

export async function setCache(key, value, ttlSeconds = env.CACHE_DEFAULT_TTL_SECONDS) {
    if (!env.CACHE_ENABLED) return value;

    if (redisReady) {
        await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
        return value;
    }

    memorySet(key, value, ttlSeconds);
    return value;
}

export async function getOrSetCache(key, ttlSeconds, loader) {
    const cached = await getCache(key);
    if (cached !== null) return cached;

    const value = await loader();
    await setCache(key, value, ttlSeconds);
    return value;
}

export async function invalidateCache(patterns = []) {
    const list = Array.isArray(patterns) ? patterns : [patterns];

    if (redisReady) {
        for (const pattern of list) {
            // node-redis v6 scanIterator yields arrays of keys per batch
            // (older versions yielded one key at a time) — handle both.
            for await (const entry of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
                const keys = Array.isArray(entry) ? entry : [entry];
                if (keys.length) await redisClient.del(keys);
            }
        }
        return;
    }

    for (const pattern of list) {
        const prefix = String(pattern).replace(/\*$/, '');
        for (const key of memoryCache.keys()) {
            if (key.startsWith(prefix)) memoryCache.delete(key);
        }
    }
}

export function cacheKey(namespace, params = {}) {
    const normalized = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([a], [b]) => a.localeCompare(b));
    return `${namespace}:${JSON.stringify(normalized)}`;
}

export function cacheStatus() {
    return {
        enabled: env.CACHE_ENABLED,
        provider: redisReady ? 'redis' : 'memory',
        redisReady,
    };
}

/**
 * Returns the shared Redis client (or null when Redis is not configured /
 * not yet connected). Other services (notification queue, rate limiter) reuse
 * this connection or duplicate it for blocking operations.
 */
export function getRedisClient() {
    return redisReady ? redisClient : null;
}

export function isRedisReady() {
    return redisReady;
}
