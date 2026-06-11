# Redis Setup (caching + realtime scale-out)

Redis is **optional**. Without it, the backend uses a built-in in-memory cache
and single-process Socket.IO — perfect for development and demos. Add Redis when
you run **multiple workers/instances** (cluster mode or horizontal scaling), so
that:

- cache is **shared** across instances (not duplicated per process), and
- realtime queue events **fan out** to clients connected to any instance.

This machine has no Docker, so pick one of the options below.

---

## Option 1 — Upstash (cloud, free, zero install) — recommended

1. Create a free database at https://upstash.com (Redis).
2. Copy the **`rediss://`** connection URL.
3. Add to `Backend/.env`:
   ```
   REDIS_URL=rediss://default:<password>@<host>:<port>
   SOCKET_IO_REDIS_URL=rediss://default:<password>@<host>:<port>
   CACHE_ENABLED=true
   ```
4. Restart the backend. You should see `Redis cache connected` and
   `Socket.IO Redis adapter connected` in the logs.

## Option 2 — Memurai (native Redis for Windows)

1. Install from https://www.memurai.com (Developer edition is free).
2. It runs as a Windows service on `localhost:6379`.
3. `Backend/.env`:
   ```
   REDIS_URL=redis://localhost:6379
   SOCKET_IO_REDIS_URL=redis://localhost:6379
   ```

## Option 3 — WSL2 (Ubuntu)

```bash
wsl --install            # if WSL not installed yet (then reboot)
# inside Ubuntu:
sudo apt update && sudo apt install -y redis-server
sudo service redis-server start
```
`Backend/.env` → `REDIS_URL=redis://localhost:6379`

## Option 4 — Docker Desktop

```bash
docker run -d --name hms-redis -p 6379:6379 redis:7-alpine
```
`Backend/.env` → `REDIS_URL=redis://localhost:6379`

---

## Verify it's working

After setting `REDIS_URL` and restarting:

```bash
# backend logs should include:
#   Redis cache connected
#   Socket.IO Redis adapter connected

# /health stays green; cache provider is reported by the cache service.
curl http://localhost:5000/health
```

Then run the backend in cluster mode and the realtime queue will stay consistent
across all workers:

```bash
cd Backend
npm run start:cluster
```

---

## Notes

- Code already supports Redis — no code change needed, only `.env`.
  See `Backend/src/services/cache.service.js` and `realtime.service.js`.
- In production behind a load balancer, also enable **sticky sessions** for
  Socket.IO (e.g. nginx `ip_hash`) in addition to the Redis adapter.
- The cache **degrades gracefully**: if Redis goes down at runtime, the service
  logs a warning and falls back to in-memory rather than erroring.

---

## Implementation status (maps to the integration spec)

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | Redis connection service | ✅ | `services/cache.service.js` (`initCache`, `getRedisClient`, `isRedisReady`) |
| 2 | Cache abstraction layer | ✅ | `cache.service.js` (`getOrSetCache`, `invalidateCache`, `cacheKey`) |
| 3 | Socket.IO Redis adapter | ✅ | `services/realtime.service.js` (`SOCKET_IO_REDIS_URL`) |
| 4 | Appointment slot caching | ✅ | `slot.controller.js` (`slots:list`), `doctor.controller.js` (`doctor-schedule:*`) |
| 5 | Doctor/admin dashboard caching | ✅ | `admin.controller.js`, `management.controller.js` (`dashboard:*`) |
| 6 | Queue caching | ✅ | `queue.controller.js` (`queue:list`, 10s TTL, invalidated on writes) |
| 7 | Notification job queue + worker | ✅ | `services/notificationQueue.service.js` (+ `push.service.js`) |
| 8 | Rate limiting via Redis | ✅ | `middleware/rateLimitStore.js` (`HybridRateLimitStore`) |
| 9 | Graceful in-memory fallback | ✅ | every service above falls back when Redis is absent |
| 10 | Health endpoint + monitoring logs | ✅ | `/health` `redis`/`cache`/`realtime`/`notifications` blocks; connect/error logs |

### Notification queue flow

```
Appointment created / POST /notifications/send
      -> enqueueNotification(job)          (returns 202 immediately)
      -> Redis list  jobs:notifications    (or in-memory array when Redis down)
      -> worker loop (BRPOP / drain)
      -> push.service (FCM)  |  email.service (Resend)
```

The in-app `notifications` document is persisted synchronously (always visible
in the UI); only the **delivery** (FCM/Resend) is deferred to the worker, so API
responses never block on third parties.

### Verifying Redis is active

`GET /health` returns a `redis` summary. With **no** Redis it looks like:

```json
"cache": { "provider": "memory", "redisReady": false },
"realtime": { "adapter": "in-memory" },
"notifications": { "backend": "memory", "running": true },
"redis": { "cache": false, "socketAdapter": false, "notificationQueue": false }
```

After setting `REDIS_URL` + `SOCKET_IO_REDIS_URL` and restarting, the same fields
flip to `redis` / `true`, and the logs show:

```
Redis cache connected
Socket.IO Redis adapter connected
Notification worker started (Redis queue)
```

### Upstash free-tier command budget

The notification worker uses a **blocking** `BRPOP`. Delivery is instant (a
pushed job unblocks `BRPOP` immediately), but each idle timeout costs one Redis
command. Tune the idle interval with `NOTIFICATION_POLL_SECONDS` (default 10):

| `NOTIFICATION_POLL_SECONDS` | Idle commands/day (per worker) |
|---|---|
| 5  | ~17,000 |
| 10 | ~8,600 |
| 30 | ~2,900 |

Each cluster **worker** runs its own loop, so multiply by worker count. On the
Upstash free tier, prefer single-process or a higher interval; for sustained
multi-worker production use a paid Redis tier or a local/dedicated Redis
(Memurai/Docker), which have no per-command cap. If the cap is hit, Redis
commands error and the system **falls back to in-memory** gracefully (the app
keeps working; logs show warnings).
