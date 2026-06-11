# Scalability & Production Architecture

How the INDUS Hospital system is built to handle high concurrency (1000+
simultaneous users) and scale horizontally as a professional, production-grade
deployment.

---

## 1. Design principles

The backend is **stateless and horizontally scalable**:

- **Stateless auth** — JWT bearer tokens. No server-side session store, so any
  request can be served by any instance. Add instances freely behind a load
  balancer.
- **Shared state lives in external services** — MongoDB Atlas (data), Redis
  (cache + Socket.IO pub/sub). App instances hold no authoritative state.
- **Async, non-blocking I/O** — Express on Node's event loop; every DB call is
  awaited, never blocking. A single process already serves thousands of
  concurrent connections; clustering multiplies that by CPU count.
- **Cache-first reads** — hot read endpoints (doctors, departments, slots,
  dashboards) are cached; writes invalidate by namespace.
- **Backpressure & protection** — rate limiting, request/header timeouts,
  body-size limits, compression, Helmet.

```
                 ┌────────────────────────────────────────┐
   Clients  ───► │   Load balancer (nginx, sticky for WS)  │
 (web/mobile)    └───────────────┬────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
     Node instance 1      Node instance 2      Node instance N
     (cluster: N cores)   (cluster: N cores)   (cluster: N cores)
            │                    │                    │
            └─────────┬──────────┴─────────┬──────────┘
                      ▼                     ▼
              MongoDB Atlas           Redis (cache +
            (replica set, pooled)    Socket.IO adapter)
                      │
                      ▼
            Python Analytics API (FastAPI, separately scalable)
```

---

## 2. Concurrency mechanisms (what's implemented)

### Multi-core clustering
`Backend/src/cluster.js` forks one worker per CPU core (configurable via
`WEB_CONCURRENCY`). All workers share port 5000 via the Node `cluster` module.

```bash
npm run start:cluster          # all cores
WEB_CONCURRENCY=4 npm run start:cluster
```

A single Node process is I/O-bound and handles high concurrency on its own;
clustering removes the single-core CPU ceiling so an 8-core box runs ~8× the
throughput.

### MongoDB connection pooling
Each instance keeps a warm pool (`MONGODB_MAX_POOL_SIZE`, default 50) of reused
connections — requests borrow/return connections instead of reconnecting.
Total DB connections = `instances × workers × maxPoolSize`; keep this under your
Atlas tier's connection limit (e.g. set `MONGODB_MAX_POOL_SIZE=20` when running
many workers on a shared tier).

### Indexed queries
All hot query paths are backed by compound indexes (see
`Backend/src/models/index.js`): `appointments(doctor_id,date,time)`,
`appointments(date,status)`, unique `slots(doctor_id,date,start_time)`, unique
`appointments.token`, TTL on `otp_verifications.expires_at`, text indexes for
search. Every list query also sets `maxTimeMS(5000)` so a slow query can't pin a
connection.

### Caching layer (`cache.service.js`)
- Redis when `REDIS_URL` is set; transparent **in-memory fallback** otherwise.
- `getOrSetCache(key, ttl, loader)` on reads; `invalidateCache(patterns)` on
  writes (e.g. booking invalidates `appointments:*`, `slots:*`, `queue:*`,
  `dashboard:*`).
- Cuts repeated DB load dramatically under burst traffic.

### Realtime that scales (`realtime.service.js`)
Socket.IO with an optional **Redis adapter** (`SOCKET_IO_REDIS_URL`). With the
adapter, queue events emitted on one instance/worker reach clients connected to
any other — required once you run more than one worker/instance.

### HTTP keep-alive & timeouts (`server.js`)
`keepAliveTimeout` (65s) < `headersTimeout` (66s) for safe reuse behind proxies;
`requestTimeout` (30s) sheds stuck requests. Graceful shutdown drains in-flight
requests, then closes Redis + Mongo, with a forced-exit safety net.

### Rate limiting
Per-IP limiter on `/api/*` (default 300 / 15 min) and a stricter limiter on auth
routes (30 / 15 min) protect against floods and brute force. For multi-instance
deployments, back the limiter with Redis (`rate-limit-redis`) so the budget is
shared — see §6.

---

## 3. Tuning knobs (env)

| Variable | Default | Purpose |
|---|---|---|
| `WEB_CONCURRENCY` | `0` (=CPU count) | Cluster workers per instance |
| `MONGODB_MAX_POOL_SIZE` | `50` | Connections per worker |
| `MONGODB_MIN_POOL_SIZE` | `0` | Warm connections kept open |
| `CACHE_ENABLED` | `true` | Toggle caching |
| `CACHE_DEFAULT_TTL_SECONDS` | `60` | Default cache TTL |
| `REDIS_URL` | — | Shared cache (multi-instance) |
| `SOCKET_IO_REDIS_URL` | =`REDIS_URL` | Realtime fan-out across workers |
| `RATE_LIMIT_MAX_REQUESTS` | `300` | Per-IP API budget / window |
| `SERVER_KEEP_ALIVE_TIMEOUT_MS` | `65000` | Socket reuse window |
| `SERVER_REQUEST_TIMEOUT_MS` | `30000` | Max request duration |
| `SHUTDOWN_TIMEOUT_MS` | `15000` | Graceful drain ceiling |

---

## 4. Running for scale

### Single box, all cores (no extra infra)
```bash
cd Backend
npm run start:cluster
```

### Production with PM2 (recommended)
```bash
npm i -g pm2
cd Backend
pm2 start ecosystem.config.cjs --env production   # cluster across all cores
pm2 reload hms-backend                              # zero-downtime redeploy
pm2 monit
```

### Multiple machines
Run N instances (each in cluster mode) behind a load balancer. Required shared
infra:
- **Redis** for cache + Socket.IO adapter (`REDIS_URL`, `SOCKET_IO_REDIS_URL`).
- **Sticky sessions** at the LB for Socket.IO (nginx `ip_hash`), or force
  WebSocket-only transport.
- **MongoDB Atlas** replica set sized so `instances × workers × pool` stays under
  the connection cap.

---

## 5. Load testing

A dependency-free concurrent load tester ships with the backend:

```bash
# Backend must be running first (npm run dev or start:cluster)
CONCURRENCY=1000 DURATION=15 npm run loadtest
# target a specific endpoint:
CONCURRENCY=500 ENDPOINT=/api/v1/doctors npm run loadtest
```

It spawns N concurrent virtual users, then reports throughput (req/s), latency
percentiles (p50/p90/p99), and status-code distribution. Use `/health`
(rate-limit-exempt) to measure raw server capacity; `/api/*` endpoints will
return 429s under a single-IP flood — that is the rate limiter working as
designed, not a failure.

---

## 6. Production hardening checklist

- [ ] `NODE_ENV=production`, `OTP_DEV_MODE=false`
- [ ] Strong unique `JWT_SECRET` and `OTP_HASH_SECRET`
- [ ] `TRUST_PROXY=true` behind a load balancer (correct client IPs for rate limiting)
- [ ] `REDIS_URL` + `SOCKET_IO_REDIS_URL` set (shared cache + realtime)
- [ ] Redis-backed rate limiter (`rate-limit-redis`) for shared budgets
- [ ] `MONGODB_MAX_POOL_SIZE` tuned to Atlas connection cap
- [ ] MongoDB Atlas: dedicated tier (M10+), replica set, alerts on connections/ops
- [ ] HTTPS termination at the LB; HTTP/2 to clients
- [ ] Sticky sessions (or WS-only) for Socket.IO
- [ ] PM2 / container orchestration with health checks on `/health`
- [ ] Centralized logging + metrics (request rate, p99 latency, error rate, pool saturation)
- [ ] CDN for the static web build; web/mobile call the API only

---

## 7. Capacity reasoning

- **App tier**: Node's event loop handles thousands of concurrent idle/keep-alive
  connections per process. With clustering (e.g. 8 workers) and cache-served hot
  reads, a single modest server comfortably absorbs 1000 concurrent users; the
  design scales out linearly by adding stateless instances.
- **Data tier** is the real ceiling. Caching + indexes + bounded query time keep
  MongoDB load low; size the Atlas tier and connection pool to your peak
  `instances × workers × pool`.
- **Analytics** is a separate FastAPI service — scale or take it offline
  independently without affecting core booking/queue flows (the backend already
  degrades gracefully if it's unavailable).
