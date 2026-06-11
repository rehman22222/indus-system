# INDUS Hospital — Doctor Appointment & Consultation Module

> Final Year Project (FYP) — a hospital management system for appointment booking,
> real-time patient queue management, video consultations, and ML-driven analytics.

**Last updated:** 2026-06-10

---

## 1. What this project is

A multi-role hospital platform built around the patient appointment lifecycle:

- **Patients** book physical or video appointments, get a token, check in, and join a live queue.
- **Doctors** see their schedule, manage their patient queue, run video consultations, and write prescriptions.
- **Management** monitors daily operations, capacity, patient flow, and performance.
- **Admin** manages doctors/departments, configures appointment rules, and views ML analytics (no-show risk, volume forecasts, disease patterns).
- **Receptionist** runs the front-desk check-in kiosk.

The system is currently **mid-migration from Supabase (PostgreSQL) to MongoDB Atlas**. The backend and analytics services are fully MongoDB-backed; the web frontend still uses a Supabase-compatible client shim that proxies to the Express API.

---

## 2. Tech stack

### Backend API (`Backend/`)
- **Runtime:** Node.js 18+ (ES Modules)
- **Framework:** Express 4
- **Database:** MongoDB Atlas via **Mongoose 8**
- **Auth:** JWT (`jsonwebtoken`) + email OTP
- **Email:** Resend (OTP + appointment confirmation)
- **Push:** Firebase Admin (FCM)
- **Realtime:** Socket.IO (+ optional Redis adapter)
- **Cache:** Redis (`redis`) with in-memory fallback
- **Video:** Daily.co REST API
- **Security/infra:** Helmet, CORS, express-rate-limit, express-validator, compression, morgan

### Analytics service (`Backend/Analytics/`)
- **Runtime:** Python
- **Framework:** FastAPI + Uvicorn
- **Database:** MongoDB via **PyMongo**
- **ML / data:** XGBoost (no-show risk), Prophet (volume forecast), scikit-learn / Random Forest (disease patterns), SHAP (explainability), Polars + Pandas (data pipeline)
- **Realtime:** WebSocket dashboard, scheduled retraining

### Web app (`Frontend/Web/`)
- **Framework:** React 18 + Vite + TypeScript
- **UI:** Tailwind CSS + shadcn/ui (Radix) + Lucide icons
- **State/data:** React Context + custom hooks + TanStack Query
- **Routing:** React Router 6
- **Realtime:** socket.io-client
- **Extras:** QR codes, WebRTC video, Groq AI helper, date-fns

### Native mobile app (`Frontend/Mobile/`)
- **Framework:** Expo SDK 56 + React Native + TypeScript
- **Navigation:** React Navigation
- **Storage:** Expo SecureStore
- **Push:** Expo Notifications
- **Video:** Daily.co native
- **Build:** EAS Build / EAS Submit
- Connects **only** to the Express backend API.

### Legacy/duplicate frontend (`Frontend/App/`)
- React Native Web built with webpack. Contains a nested duplicate (`Frontend/App/APP/`). Superseded by `Frontend/Mobile/` — cleanup candidate.

---

## 3. Repository layout

```
fyp/
├── Backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js              # Validated env loader (freezes config)
│   │   │   └── mongodb.js          # Mongoose connection + health
│   │   ├── models/
│   │   │   └── index.js            # All 14 Mongoose schemas + indexes
│   │   ├── middleware/
│   │   │   ├── auth.js             # JWT verify, requireRole, optionalAuth
│   │   │   ├── errorHandler.js     # Global handler, AppError, asyncHandler
│   │   │   └── validator.js        # express-validator result handler
│   │   ├── controllers/            # Domain logic (appointment, doctor, queue, ...)
│   │   ├── routes/                 # Express routers (one per domain + data shim)
│   │   ├── services/
│   │   │   ├── otp.service.js      # OTP generate/verify (hashed)
│   │   │   ├── email.service.js    # Resend email templates
│   │   │   ├── password.service.js # scrypt hash/verify
│   │   │   ├── cache.service.js    # Redis + in-memory cache
│   │   │   └── realtime.service.js # Socket.IO queue events
│   │   ├── scripts/                # db seed + ensure-indexes
│   │   ├── utils/                  # mongo.js, api.js (query builders)
│   │   └── server.js               # App entry point
│   └── Analytics/
│       ├── api/                    # FastAPI app, routes, auth, middleware
│       ├── data/                   # mongodb_client, loader, preprocessor, features
│       ├── models/                 # risk, volume, disease, ensemble, trainer
│       ├── explainability/         # SHAP
│       ├── realtime_dashboard/     # WebSocket live stats
│       ├── scheduler/              # retrain scheduler
│       └── saved_models/           # persisted .pkl models
├── Frontend/
│   ├── Web/                        # React + Vite web app (admin/mgmt/doctor)
│   ├── Mobile/                     # Expo native app (patient/doctor)
│   └── App/                        # Legacy RN-Web (webpack) — duplicate
├── Database/                       # Legacy Supabase SQL schema (00–05_*.sql)
├── docs/                           # Architecture docs (mongodb.md is current)
├── SETUP.txt                       # Quick setup guide
└── package.json                    # Root orchestration scripts
```

---

## 4. Data model (MongoDB collections)

Defined in [Backend/src/models/index.js](Backend/src/models/index.js). Timestamps use `created_at` / `updated_at`.

| Collection | Purpose | Key fields / indexes |
|---|---|---|
| `users` | All roles (patient/doctor/admin/management/receptionist) | unique partial `email`, `phone`; text index on name/email/phone; `push_tokens[]` for FCM/APNs/Expo |
| `doctors` | Doctor profiles | `department_id`, `specialty`, `is_available`; unique partial `license_number`; text index |
| `departments` | Hospital departments | unique `name`, icon/color, `head_doctor_id` |
| `slots` | Doctor availability | unique `(doctor_id, date, start_time)`; `max_patients`/`current_patients` |
| `appointments` | Bookings | unique `token`; status enum; `(patient_id, doctor_id, slot_id)` partial-unique for active; video room fields |
| `prescriptions` | Medications | `appointment_id`, `doctor_id`, `patient_id`, `medications[]` |
| `medical_records` | Patient history | `record_type` enum, `recorded_date` |
| `queue` | Live patient queue | unique `appointment_id`, `position`, status |
| `notifications` | In-app/push | `user_id`, `read`, `data` |
| `otp_verifications` | OTP codes | hashed `code_hash`, **TTL index** on `expires_at` |
| `analytics_events` | Tracking | `event_type`, `event_data` |
| `audit_logs` | Audit trail | `action`, `collection_name`, `record_id`, old/new data |
| `system_settings` | Config | unique `setting_key` |
| `appointment_rules` | Governance | `rule_type` enum, `rule_config`, `priority` |

**Appointment statuses:** `scheduled, confirmed, waiting, called, in_consultation, completed, cancelled, no_show, rescheduled`
(legacy `in-progress`/`no-show` auto-normalized).

**Queue statuses:** `waiting, called, in_consultation, completed, no_show`

---

## 5. Backend API surface

Base URL: `http://localhost:5000`

| Route prefix | Module | Notes |
|---|---|---|
| `/api/auth` | login, send-otp, verify-otp, resend-otp | JWT issuance |
| `/api/v1/otp` | OTP controller | identifier-based OTP |
| `/api/v1/appointments` | CRUD + patient/doctor scoped lists | transactional booking |
| `/api/v1/doctors` | List/detail/create/update + slots | cached, text search |
| `/api/v1/departments` | List/detail/create | cached |
| `/api/v1/patients` | List/detail/create/update | role-scoped |
| `/api/v1/slots` | List/detail/create/update | cached |
| `/api/v1/queue` | Live queue + status updates | emits Socket.IO events |
| `/api/v1/prescriptions` | CRUD | doctor/patient scoped |
| `/api/v1/notifications` | List/update/send/bulk/register-token | FCM via Firebase Admin |
| `/api/v1/video` | create-room | Daily.co |
| `/api/v1/analytics` | risks/diseases/volume/explain/live/train | proxies Python service |
| `/api/v1/admin` | dashboard, audit logs, system settings | staff only |
| `/api/v1/management` | dashboard, operational appointments | staff only |
| `/api/v1/data/:collection` | **Supabase-compat shim** | generic CRUD fallback for legacy frontend queries |
| `/health` | DB readiness + uptime | skips rate limit |

### Key backend behaviors
- **Transactional booking** ([appointment.controller.js](Backend/src/controllers/appointment.controller.js)): atomically reserves slot (optimistic `current_patients < max_patients`), generates unique token, creates appointment + queue entry + audit log + notification in one Mongo transaction.
- **Role scoping**: patients see only their data; doctors see only their patients/appointments; staff (admin/management/receptionist) see all.
- **Caching**: read endpoints use `getOrSetCache`; writes call `invalidateCache` with namespace patterns (`appointments:*`, `slots:*`, `queue:*`, `dashboard:*`, ...).
- **Realtime**: queue/appointment changes emit Socket.IO events (`queue.updated`, `patient.checked_in`, `patient.called`, `consultation.started/completed`, `appointment.cancelled`) to `queue` and `doctor:<id>` rooms.

---

## 6. Analytics service (Python ML)

Base URL: `http://localhost:8000`

| Endpoint | Model | Output |
|---|---|---|
| `GET /api/predict/risks` | XGBoost | No-show risk per upcoming appointment + top factors |
| `GET /api/predict/diseases` | Random Forest | Specialty-level disease burden forecast |
| `GET /api/forecast/volume` | Prophet | Patient volume forecast with confidence intervals |
| `GET /api/predict/ensemble` | Combined | Highest-accuracy aggregate |
| `GET /api/explain/{patient_id}` | SHAP | Why a patient was flagged high-risk |
| `GET /api/stats/live` + `/stats/summary` | — | Real-time dashboard stats |
| `POST /api/train` | — | Trigger retraining (admin) |

- Reads MongoDB directly via [mongodb_client.py](Backend/Analytics/data/mongodb_client.py) using the same `MONGODB_URI` / `MONGODB_DB_NAME`.
- **Target-leakage guard** ([feature_engineer.py](Backend/Analytics/data/feature_engineer.py)): excludes the DB's precomputed `no_show_risk_score` and history-derived rates from model inputs; uses only prediction-time-knowable features (date parts, hour, lead days, specialty/age encodings).
- Models persist to `saved_models/*.pkl`; auto-retrains if the saved feature count drifts.
- All `/api` routes optionally guarded by `ANALYTICS_API_KEY`.

---

## 7. Frontend architecture (Web)

- **Supabase-compatible client** ([integrations/mongodb/client.ts](Frontend/Web/src/integrations/mongodb/client.ts)): exposes `MongoDB.from('collection').select().eq()...` plus `.auth`, `.channel`, `.rpc`. Translates query-builder calls into REST calls — domain routes when available, else the `/api/v1/data` shim. This let dozens of existing hooks keep working through the migration.
- **`safeQuery`** ([lib/safeQuery.ts](Frontend/Web/src/lib/safeQuery.ts)): wraps every query with graceful fallback (never throws; returns fallback on network/schema errors).
- **Hybrid auth** ([auth/AuthGate.tsx](Frontend/Web/src/auth/AuthGate.tsx), [auth/authStore.ts](Frontend/Web/src/auth/authStore.ts)):
  - Staff (admin/doctor/management/receptionist) live in an in-memory `authStore` (persisted account registry, non-persisted session → always shows login on fresh launch).
  - Patients authenticate via OTP and are routed to the **mobile handoff** (`/patient` → mobile-only page) on web.
- **Routing** ([App.tsx](Frontend/Web/src/App.tsx)): `/admin`, `/management`, `/doctor`, `/check-in` (kiosk), `/patient` (mobile handoff), `/reset-password`. Lazy-loaded pages, TanStack Query provider.
- **Role → route map:** ADMIN→`/admin`, MANAGEMENT→`/management`, DOCTOR→`/doctor`, PATIENT→`/patient`, RECEPTIONIST→`/check-in`.

---

## 8. Environment variables

### Backend (`Backend/.env`)
```
PORT=5000
NODE_ENV=development
OTP_DEV_MODE=true
MONGODB_URI=<atlas-uri>
MONGODB_DB_NAME=doctorappointment
MONGODB_AUTO_INDEX=false
MONGODB_ENSURE_INDEXES_ON_STARTUP=false
JWT_SECRET=<strong-secret>
JWT_EXPIRES_IN=24h
OTP_HASH_SECRET=<strong-secret>     # falls back to JWT_SECRET
OTP_EXPIRY_MINUTES=10
RESEND_API_KEY=<key>
OTP_FROM_EMAIL / OTP_FROM_NAME
DAILY_API_KEY / DAILY_API_URL       # video (production)
FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY   # push (production)
ANALYTICS_API_URL=http://localhost:8000
CORS_ORIGINS / CORS_ORIGIN
RATE_LIMIT_* / AUTH_RATE_LIMIT_*
REDIS_URL / SOCKET_IO_REDIS_URL     # optional scaling
CACHE_ENABLED / CACHE_DEFAULT_TTL_SECONDS
```

### Analytics (`Backend/Analytics/.env`)
```
MONGODB_URI
MONGODB_DB_NAME=doctorappointment
USE_MOCK_DATA=false
CORS_ORIGINS
ANALYTICS_API_KEY    # optional
```

### Web (`Frontend/Web/.env`)
```
VITE_API_BASE_URL=http://localhost:5000
VITE_API_URL=http://localhost:5000
VITE_ML_API_URL=http://localhost:8000
VITE_FIREBASE_* / VITE_DAILY_API_KEY / VITE_GROQ_API_KEY   # optional
```

### Mobile (`Frontend/Mobile/.env`)
```
EXPO_PUBLIC_API_BASE_URL=http://<host>:5000
EXPO_PUBLIC_APP_NAME="Indus Hospital"
```

> **Rule:** MongoDB URI, JWT/OTP secrets, Resend/Daily/Firebase keys live on the **backend only**. Frontend/mobile talk to the API exclusively.

---

## 9. Setup & run

```bash
# 1. Install
cd Backend && npm install && cd ..
cd Frontend/Web && npm install && cd ../..
cd Frontend/Mobile && npm install && cd ../..   # optional

# 2. Configure: copy each .env.example to .env and fill in keys

# 3. Seed the database
cd Backend
npm run db:ensure-indexes
npm run db:seed            # demo departments/users/doctors/slots/appointments
npm run db:seed:all        # + analytics demo data
cd ..

# 4. Run (from repo root)
npm run dev                # backend + web
npm run web                # backend + mobile-web demo
npm run dev:analytics      # Python analytics service
npm run dev:mobile         # Expo native app
```

| Service | URL |
|---|---|
| Backend API | http://localhost:5000 |
| Web app | http://localhost:5173 |
| Mobile web demo | http://localhost:3001 |
| Analytics API | http://localhost:8000 |

---

## 10. Demo credentials

All demo users: password **`123456`**.

| Role | URL | Email |
|---|---|---|
| Admin | /admin | `admin@gmail.com` |
| Management | /management | `management1@indus.org.pk` |
| Doctor | /doctor (web) or mobile | `doctor1@indus.org.pk` |
| Patient | mobile / http://localhost:3001 | `patient1@example.com` |

In **OTP dev mode** (`OTP_DEV_MODE=true`) the OTP code is returned in the API response and printed to the backend console.

---

## 11. Testing

| Target | Command |
|---|---|
| Backend | `npm run test:backend` (node --test) |
| Analytics | `npm run test:analytics` (pytest) |
| Web | `npm run test:web` |
| Type-check mobile | `npm run verify:mobile` |
| Full verify | `npm run verify` |

---

## 12. Current state & known issues

- **Migration in progress:** Backend + Analytics are fully MongoDB. The web frontend still uses the Supabase-compatible client shim (proxying to the Express API) rather than calling domain routes directly.
- **Stale docs:** [docs/database.md](docs/database.md) and [docs/backend.md](docs/backend.md) still describe Supabase/PostgreSQL with find-replace artifacts (e.g. `"mongoose + MongoDB API client"`). [docs/mongodb.md](docs/mongodb.md) and [docs/credentials.md](docs/credentials.md) are current/accurate.
- **Duplicate frontend:** `Frontend/App/` and the nested `Frontend/App/APP/` are near-identical RN-Web copies, superseded by `Frontend/Mobile/` — cleanup candidate.
- **Legacy SQL:** `Database/*.sql` is the old Supabase schema, kept for reference only.
- **Git:** single initial commit; the entire Supabase→Mongo migration currently lives in the uncommitted working tree.

### Scaling (industry-grade, 1000+ concurrent users)
The backend is stateless and horizontally scalable. See **[docs/scalability.md](docs/scalability.md)** for the full architecture. Highlights:
- **Multi-core cluster mode**: `npm run start:cluster` (`Backend/src/cluster.js`) forks one worker per CPU core, all sharing port 5000. Verified locally with 16 workers.
- **Production process manager**: `Backend/ecosystem.config.cjs` (PM2 cluster, zero-downtime reloads) → `npm run start:prod`.
- **Load tester**: `npm run loadtest` (`CONCURRENCY=1000 npm run loadtest`). Verified **1000 concurrent users → 0 errors, ~4,400 req/s, p99 ≈ 340ms** on `/health`.
- **Foundations**: JWT statelessness, Redis cache + Socket.IO Redis adapter (in-memory fallback in dev), Mongo connection pooling + compound/TTL indexes, per-IP rate limiting, keep-alive/header/request timeouts, graceful shutdown.

### Before production
- Real `DAILY_API_KEY` (video), Firebase Admin credentials (push).
- Strong unique `JWT_SECRET` and `OTP_HASH_SECRET`.
- HTTPS API domain; set `OTP_DEV_MODE=false`; `TRUST_PROXY=true` behind a load balancer.
- Set `REDIS_URL` / `SOCKET_IO_REDIS_URL` for multi-instance cache + Socket.IO scaling (required once running >1 worker/instance).
- Mobile: EAS project, `google-services.json` / `GoogleService-Info.plist`.
```
