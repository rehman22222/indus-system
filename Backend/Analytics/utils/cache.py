import os
import json
import redis.asyncio as aioredis
from utils.logger import get_logger

logger = get_logger(__name__)
_redis = None


async def _get_redis():
    global _redis
    if _redis is None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379")
        try:
            _redis = aioredis.from_url(url, decode_responses=True)
            await _redis.ping()
            logger.info("Redis connected")
        except Exception:
            logger.warning("Redis unavailable — caching disabled")
            _redis = None
    return _redis


async def cache_get(key: str):
    r = await _get_redis()
    if not r:
        return None
    try:
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


async def cache_set(key: str, value, ttl: int = 300):
    r = await _get_redis()
    if not r:
        return
    try:
        await r.setex(key, ttl, json.dumps(value))
    except Exception:
        pass