/**
 * Hybrid rate-limit store for express-rate-limit v7.
 *
 * Uses Redis (shared across all workers/instances) when available, and falls
 * back to express-rate-limit's in-process MemoryStore when Redis is down — so
 * limiting keeps working in single-process/dev and degrades gracefully if Redis
 * disconnects at runtime.
 */
import { MemoryStore } from 'express-rate-limit';
import { getRedisClient } from '../services/cache.service.js';

export class HybridRateLimitStore {
    constructor(prefix = 'rl:') {
        this.prefix = prefix;
        this.memory = new MemoryStore();
        this.windowMs = 60_000;
    }

    init(options) {
        this.windowMs = options.windowMs;
        this.memory.init(options);
    }

    async increment(key) {
        const redis = getRedisClient();
        if (!redis) return this.memory.increment(key);

        const redisKey = this.prefix + key;
        try {
            const totalHits = await redis.incr(redisKey);
            let ttl = await redis.pTTL(redisKey);
            if (totalHits === 1 || ttl < 0) {
                await redis.pExpire(redisKey, this.windowMs);
                ttl = this.windowMs;
            }
            return { totalHits, resetTime: new Date(Date.now() + ttl) };
        } catch (error) {
            console.warn('Rate limiter Redis error, using memory:', error.message);
            return this.memory.increment(key);
        }
    }

    async decrement(key) {
        const redis = getRedisClient();
        if (!redis) return this.memory.decrement(key);
        try {
            await redis.decr(this.prefix + key);
        } catch {
            this.memory.decrement(key);
        }
    }

    async resetKey(key) {
        const redis = getRedisClient();
        if (!redis) return this.memory.resetKey(key);
        try {
            await redis.del(this.prefix + key);
        } catch {
            this.memory.resetKey(key);
        }
    }
}
