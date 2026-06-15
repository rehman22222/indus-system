# INDUS Hospital — Doctor Appointment & Consultation Module

> Final Year Project (FYP) — a hospital management system for appointment booking,
> real-time patient queue management, video consultations, and ML-driven analytics.

**Last updated:** 2026-06-14

---

## 1. What this project is

A multi-role hospital platform built around the patient appointment lifecycle:

- **Patients** register (email OTP), book physical or video appointments, choose a **visit type** (new / follow-up), upload reports & past prescriptions, get a token + QR, check in, join a live queue, take a **video consultation**, and view their prescriptions/history.
- **Doctors** see their schedule, run their live patient queue, take video consultations, and write prescriptions.
- **Management** monitors daily operations, capacity, patient flow, performance, broadcasts announcements, and can pause online booking.
- **Admin** manages doctors/departments, system settings, audit logs, and ML analytics.
- **Receptionist** runs the front-desk check-in kiosk.

The system was **migrated from Supabase (PostgreSQL) to MongoDB Atlas**. The backend and analytics services are fully MongoDB-backed; the web frontend still uses a Supabase-compatible client shim that proxies to the Express API.

### Available on two clients
- **Web app** (`Frontend/Web/`): all four staff/patient portals — **Admin, Management, Doctor, and Patient** — plus the check-in kiosk and the in-browser video-call room.
- **Native mobile app** (`Frontend/Mobile/`, Expo): **Patient** and **Doctor** roles, with a tabbed dashboard, dark mode, and English/Urdu support.

---

## 2. Tech stack

### Backend API (`Backend/`)
- **Runtime:** Node.js 18+ (ES Modules) · **Framework:** Express 4
- **Database:** MongoDB Atlas via **Mongoose 8**
- **Auth:** JWT (`jsonwebtoken`) + email OTP · **Passwords:** scrypt
- **Email:** **Gmail SMTP via Nodemailer** (primary) with **Resend** fallback — selectable by `EMAIL_PROVIDER`
- **Push:** Firebase Admin (FCM)
- **Realtime:** Socket.IO (+ optional Redis adapter), incl. WebRTC signaling
- **Cache:** Redis (`redis`) with in-memory fallback
- **Video tokens:** **Agora** (`agora-token`) for native/web RTC; Daily.co REST optional
- **Security/infra:** Helmet, CORS, express-rate-limit, express-validator, compression, morgan

### Analytics service (`Backend/Analytics/`)
- **Python** + **FastAPI** + Uvicorn · **DB:** MongoDB via **PyMongo**
- **ML:** XGBoost (no-show risk), Prophet (volume forecast), Random Forest (disease patterns), SHAP (explainability), Pandas/Polars pipeline
- **Realtime:** WebSocket dashboard, scheduled retraining

### Web app (`Frontend/Web/`)
- **React 18 + Vite + TypeScript** · **UI:** Tailwind + shadcn/ui (Radix) + Lucide
- **Data:** Supabase-compatible Mongo client shim + custom hooks + TanStack Query
- **Routing:** React Router 6 (lazy pages) · **Realtime:** socket.io-client
- **Video:** in-browser WebRTC room + **Agora Web SDK** (`agora-rtc-sdk-ng`) · **QR codes**, date-fns

### Native mobile app (`Frontend/Mobile/`)
- **Expo SDK 54** + React Native + TypeScript (Expo Go compatible, except native video)
- **Navigation:** React Navigation — native stack + **bottom tabs**
- **Theming:** custom **ThemeContext** (light/dark, persisted) — full dark mode
- **i18n:** custom **LanguageContext** — **English / Urdu** with RTL
- **Storage:** AsyncStorage + Expo SecureStore · **Push:** Expo Notifications
- **Docs:** expo-document-picker / expo-file-system / expo-sharing (report/prescription upload + view)
- **Video:** **native Agora** (`react-native-agora`) — requires a custom dev build (not Expo Go)
- Connects **only** to the Express backend API.

### Legacy/duplicate frontend (`Frontend/App/`)
- React Native Web (webpack), with a nested duplicate (`Frontend/App/APP/`). Superseded by `Frontend/Mobile/` and `Frontend/Web/` — **cleanup candidate**.

---

## 3. Repository layout

```
fyp/
├── Backend/
│   ├── src/
│   │   ├── config/        # env.js (validated loader), mongodb.js (connection + health)
│   │   ├── models/index.js   # All 15 Mongoose schemas + indexes
│   │   ├── middleware/    # auth.js, errorHandler.js, validator.js, rateLimitStore.js
│   │   ├── controllers/   # appointment, doctor, patient, queue, prescription, document,
│   │   │                  #   video, notification, admin, management, analytics, ...
│   │   ├── routes/        # one router per domain + /api/v1/data shim
│   │   ├── services/      # otp, email, password, cache, realtime, agora,
│   │   │                  #   notificationQueue, push
│   │   ├── scripts/       # db seed + ensure-indexes + seedSlots
│   │   ├── utils/         # mongo.js, api.js (query/projection/sort builders)
│   │   ├── cluster.js     # multi-core cluster entry
│   │   └── server.js      # app entry point
│   └── Analytics/         # FastAPI ML service (api, data, models, explainability,
│                          #   realtime_dashboard, scheduler, saved_models)
├── Frontend/
│   ├── Web/               # React + Vite — Admin/Management/Doctor/Patient/Kiosk/Video
│   ├── Mobile/            # Expo native app — Patient + Doctor
│   └── App/               # Legacy RN-Web (webpack) — duplicate, unused
├── Database/              # Legacy Supabase SQL schema (00–05_*.sql) — reference only
├── docs/                  # Architecture docs (mongodb.md, scalability.md, redis.md, ...)
├── poster/               # 4K project poster (SVG + PNG)
├── scripts/start-dev-https.ps1   # Cloudflare quick-tunnel for the HTTPS video page
├── SETUP.txt
└── package.json          # Root orchestration scripts
```

---

## 4. Data model (15 MongoDB collections)

Defined in [Backend/src/models/index.js](Backend/src/models/index.js). Timestamps use `created_at` / `updated_at`.

| Collection | Purpose | Notable fields |
|---|---|---|
| `users` | All roles | partial-unique `email`/`phone`; `gender`, `date_of_birth`, `medical_history` (holds `cnic`/`age` from signup); `push_tokens[]` |
| `doctors` | Doctor profiles | `department_id`, `specialty`, `max_patients_per_day`, **`daily_video_quota`**, `available_hours`, `is_available` |
| `departments` | Departments | unique `name`, icon/color |
| `slots` | Doctor availability | unique `(doctor_id, date, start_time)`, capacity counters |
| `appointments` | Bookings | unique `token`; status enum; **`visit_type`** (new/follow_up); `history_summary`; consultation timestamps; video room fields |
| `prescriptions` | Medications | `appointment_id`, `medications[]`, instructions, follow-up |
| `medical_records` | Patient history | `record_type`, `recorded_date` |
| **`medical_documents`** | **Reports / past prescriptions** | base64 file storage (`data` select:false), `kind` (report/prescription/other), `appointment_id` |
| `queue` | Live patient queue | unique `appointment_id`, `position`, status |
| `notifications` | In-app/push | `user_id`, `read`, broadcast support |
| `otp_verifications` | OTP codes | hashed `code_hash`, **TTL index** |
| `analytics_events` | Tracking | `event_type`, `event_data` |
| `audit_logs` | Audit trail | `action`, `collection_name`, old/new data |
| `system_settings` | Config | unique `setting_key` (e.g. `slots_blocked`) |
| `appointment_rules` | Governance | `rule_type`, `rule_config`, `priority` |

**Appointment statuses:** `scheduled, confirmed, waiting, called, in_consultation, completed, cancelled, no_show, rescheduled`

---

## 5. Backend API surface

Base URL: `http://localhost:5000`

| Route prefix | Notes |
|---|---|
| `/api/auth` | login, **send-otp**, **verify-otp** (signup stores name/phone/gender/cnic/age), resend-otp, password-reset |
| `/api/v1/appointments` | transactional booking, status, reassign; role-scoped lists; emits realtime events |
| `/api/v1/doctors` | list/detail/create/update (+ `daily_video_quota`), slots; emits `queue.updated` on change |
| `/api/v1/departments`, `/api/v1/slots`, `/api/v1/patients` | CRUD; **patients may read their own profile (self-scoped)** |
| `/api/v1/queue` | live queue + status updates → Socket.IO |
| `/api/v1/prescriptions` | doctor/patient scoped CRUD |
| **`/api/v1/documents`** | **upload / list / view** medical documents (base64), patient + staff |
| `/api/v1/notifications` | list/update/send/bulk/register-token; **broadcast fan-out** to a role or all users |
| **`/api/v1/video`** | `create-room`, `decline`, `context`, **`agora-token`**, **`agora-test-token`** (dev), `documents/:id`, `prescription` |
| `/api/v1/analytics` | proxies the Python ML service |
| `/api/v1/admin` · `/api/v1/management` | dashboards, audit logs, system settings (filterable by key) |
| `/api/v1/data/:collection` | Supabase-compat shim (generic CRUD) for legacy web hooks |
| `/health` | DB readiness, cache/realtime/notification status flags |

### Key behaviors
- **Transactional booking** — atomically reserves slot, generates token, creates appointment + queue entry + audit log in one transaction; honors the `slots_blocked` system setting (management can pause online booking).
- **Realtime** — appointment/queue/doctor changes emit Socket.IO events (`queue.updated`, `patient.checked_in/called`, `consultation.started/completed`, `appointment.cancelled`) so all open portals update live.
- **Role scoping** — patients see only their own data (incl. their own patient profile); doctors see only their patients; staff see all.
- **Caching** — read endpoints use `getOrSetCache`; writes `invalidateCache` namespaced patterns.

---

## 6. Video consultation architecture

Selectable via **`VIDEO_PROVIDER`** (`webrtc` default · `agora` · `jitsi` · `daily`). The doctor starts the call → the patient is **rung in real time** (`call:incoming`) and can accept (with consent) or decline with a reason (`call:declined`).

- **`agora`** (preferred for native): backend mints short-lived **Agora RTC tokens** ([agora.service.js](Backend/src/services/agora.service.js) via `agora-token`); channel = `indus-appointment-<id>`, per-role uid.
  - **Web** (doctor + the `/agora-test` page) uses **`agora-rtc-sdk-ng`**.
  - **Mobile** patient uses **native `react-native-agora`** ([NativeVideoCallScreen](Frontend/Mobile/src/screens/shared/NativeVideoCallScreen.tsx)) — **no browser/tunnel needed**, but requires a **custom Expo dev build** (won't run in Expo Go).
- **`webrtc`** (default fallback): a self-hosted room at the web `/video-call` page using `RTCPeerConnection` + Socket.IO signaling. Because the mobile browser needs HTTPS for the camera, dev serves this page through a **Cloudflare quick-tunnel** (`scripts/start-dev-https.ps1`, writing `CALL_WEB_BASE_URL`).
- **`jitsi`** / **`daily`**: optional hosted providers retained behind the same switch.

---

## 7. Analytics service (Python ML)

Base URL: `http://localhost:8000` (docs at `/docs`)

| Endpoint | Model | Output |
|---|---|---|
| `GET /api/predict/risks` | XGBoost | No-show risk per appointment + factors |
| `GET /api/predict/diseases` | Random Forest | Specialty disease burden |
| `GET /api/forecast/volume` | Prophet | Patient volume forecast |
| `GET /api/predict/ensemble` | Combined | Aggregate prediction |
| `GET /api/explain/{patient_id}` | SHAP | Why a patient is high-risk |
| `GET /api/stats/live` · `/stats/summary` | — | Live dashboard stats |
| `POST /api/train` | — | Trigger retraining |

- Reads MongoDB directly; **target-leakage guard** excludes precomputed scores from inputs.
- Models persist to `saved_models/*.pkl`; auto-retrains on feature drift. Routes optionally guarded by `ANALYTICS_API_KEY`.

---

## 8. Frontend — Web

- **Supabase-compatible client** ([integrations/mongodb/client.ts](Frontend/Web/src/integrations/mongodb/client.ts)): `MongoDB.from('collection').select().eq()...` plus `.auth`, `.channel`, `.rpc` → translated to REST (domain routes or the `/api/v1/data` shim). `safeQuery` wraps queries with graceful fallback.
- **Hybrid auth** ([AuthGate.tsx](Frontend/Web/src/auth/AuthGate.tsx)): staff live in an in-memory `authStore`; patients authenticate via OTP. All roles route to their portal.
- **Routes** ([App.tsx](Frontend/Web/src/App.tsx)): `/` (portal picker), `/admin`, `/management`, `/doctor`, **`/patient`** (full patient dashboard — booking, appointments, prescriptions, history, profile, video), `/check-in` (kiosk), `/video-call` (consultation room), `/agora-test` (Agora connectivity check), `/reset-password`.

## 9. Frontend — Mobile (Expo, patient + doctor)

- **Navigation** ([RootNavigator.tsx](Frontend/Mobile/src/navigation/RootNavigator.tsx)):
  - **Patient** → bottom-tab dashboard ([PatientTabs.tsx](Frontend/Mobile/src/navigation/PatientTabs.tsx)): **Home · Appointments · Doctors · History · Profile**, plus pushed **Book Appointment** and **Appointment Details** screens.
  - **Doctor** → home with custom tabs (overview / schedule / Rx history / profile) + clinical workspace.
- **Shared INDUS branding** — navy logo header ([PortalHeader.tsx](Frontend/Mobile/src/components/PortalHeader.tsx)) matching the doctor portal.
- **Premium Doctors page** — doctor profile cards (specialty, department, rating, experience, fee, languages) with a Book CTA.
- **Dark mode** — [ThemeContext.tsx](Frontend/Mobile/src/theme/ThemeContext.tsx) (light/dark INDUS palettes, persisted) + a sun/moon toggle in both portal headers.
- **English / Urdu** — [LanguageContext.tsx](Frontend/Mobile/src/i18n/LanguageContext.tsx) with RTL, toggle in the header.
- **Signup parity with web** — First/Last name, **CNIC (13 digits)**, phone, age, gender, password; OTP email verification; plus a **forgot-password** (OTP reset) flow.
- **Document upload/view** — attach report/prescription images or PDFs during booking; open them via share sheet.
- **QR token** ([AppointmentQrCard.tsx](Frontend/Mobile/src/components/AppointmentQrCard.tsx)); incoming-call ring ([IncomingCallProvider.tsx](Frontend/Mobile/src/components/IncomingCallProvider.tsx)).

---

## 10. Environment variables (`Backend/.env`)

```
PORT=5000 · NODE_ENV=development · OTP_DEV_MODE=false
MONGODB_URI=<atlas-uri> · MONGODB_DB_NAME=doctorappointment
JWT_SECRET / OTP_HASH_SECRET / JWT_EXPIRES_IN / OTP_EXPIRY_MINUTES

# Email (OTP + confirmations) — SMTP preferred, Resend fallback
EMAIL_PROVIDER=smtp                     # auto | smtp | resend
SMTP_HOST=smtp.gmail.com · SMTP_PORT=465 · SMTP_SECURE=true
SMTP_USER=<gmail> · SMTP_PASS=<gmail app password>
OTP_FROM_EMAIL=<sender> · OTP_FROM_NAME=INDUS Hospital
RESEND_API_KEY=<key>                    # fallback only

# Video
VIDEO_PROVIDER=agora                    # webrtc | agora | jitsi | daily
AGORA_APP_ID=<id> · AGORA_APP_CERTIFICATE=<secret> · AGORA_TOKEN_TTL_SECONDS=3600
CALL_WEB_BASE_URL=<https tunnel/domain> · JITSI_BASE_URL · DAILY_API_KEY

FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY   # push
ANALYTICS_API_URL=http://localhost:8000
REDIS_URL / SOCKET_IO_REDIS_URL · CACHE_ENABLED · RATE_LIMIT_* · TRUST_PROXY
```

Web: `VITE_API_BASE_URL`, `VITE_ML_API_URL`. Mobile auto-derives the API host from Metro (`EXPO_PUBLIC_API_BASE_URL` optional). **All secrets (Mongo, JWT, SMTP, Agora cert, Firebase) live on the backend only.**

> ⚠️ Several live keys were used during development (SMTP app password, Agora App Certificate, Firebase, Resend). **Rotate them before any production/submission.**

---

## 11. Setup & run

```bash
# Install
cd Backend && npm install && cd ..
cd Frontend/Web && npm install && cd ../..
cd Frontend/Mobile && npm install && cd ../..

# Seed
cd Backend && npm run db:ensure-indexes && npm run db:seed:all && cd ..

# Run (repo root)
npm run dev            # backend + web
npm run dev:analytics  # Python ML service
npm run dev:https      # (optional) Cloudflare tunnel for the webrtc video page

# Mobile — run from Frontend/Mobile with the LOCAL Expo SDK 54 (not repo root)
npm run dev:mobile:expo-go     # Expo Go (everything except native Agora video)
# native Agora video needs a dev build: eas build -p android --profile development
```

| Service | URL |
|---|---|
| Backend API | http://localhost:5000 |
| Web app (all 4 portals) | http://localhost:5173 |
| Analytics API | http://localhost:8000 |

---

## 12. Demo credentials

All demo users: password **`123456`**.

| Role | Where | Email |
|---|---|---|
| Admin | web `/admin` | `admin@gmail.com` |
| Management | web `/management` | `management1@indus.org.pk` |
| Doctor | web `/doctor` or mobile | `doctor1@indus.org.pk` |
| Patient | web `/patient` or mobile | `patient1@example.com` |

New patients self-register with email OTP (delivered via Gmail SMTP). In `OTP_DEV_MODE=true` the code is printed to the backend console instead of emailed.

---

## 13. Recent updates (this cycle)

- **Email/OTP fixed** — switched OTP delivery from sandboxed Resend to **Gmail SMTP**; signup now works for any email (web + mobile).
- **Mobile patient app redesigned** — 5-tab dashboard, navy INDUS-logo header, premium Doctors page, **dark mode**, **EN/Urdu**, web-parity signup + forgot-password.
- **Patient web portal enabled** — `/patient` is now a full dashboard (was a mobile-only handoff); all four web roles functional.
- **Agora video** — backend token service + endpoints; web SDK + native `react-native-agora`; selectable via `VIDEO_PROVIDER`.
- **Visit type + medical documents** — new/follow-up choice and base64 report/prescription uploads, surfaced to the doctor portal.
- **Admin/Management data-flow fixes** — broadcast fan-out actually delivers; `daily_video_quota` persists; "block all slots" is enforced; settings filter-by-key.

## 14. Known issues / cleanup

- **Migration shim:** the web frontend still uses the Supabase-compatible client (proxying the Express API) rather than calling domain routes directly.
- **Duplicate frontend:** `Frontend/App/` (and nested `Frontend/App/APP/`) are unused copies — safe to delete.
- **Legacy SQL:** `Database/*.sql` is the old Supabase schema, reference only.
- **Stale docs:** some `docs/*.md` still describe Supabase; `mongodb.md` / `scalability.md` are current.
- **`cnic`/`age`** are stored inside `users.medical_history` (not first-class columns) — works, but could be promoted to dedicated fields.
- **Native Agora video** requires a custom Expo dev build; it does not run in Expo Go.

### Scaling (1000+ concurrent users)
Stateless, horizontally scalable. `npm run start:cluster` (multi-core) / PM2 `ecosystem.config.cjs`; Redis cache + Socket.IO Redis adapter (in-memory fallback in dev); Mongo pooling + compound/TTL indexes; per-IP rate limiting; graceful shutdown. Load-tested at ~1000 concurrent users on `/health`. See **[docs/scalability.md](docs/scalability.md)**.

### Before production
Rotate all dev keys; strong unique `JWT_SECRET`/`OTP_HASH_SECRET`; `OTP_DEV_MODE=false`; HTTPS API domain + `TRUST_PROXY=true`; set `REDIS_URL`/`SOCKET_IO_REDIS_URL`; verify a real sending domain (or keep Gmail SMTP within its ~500/day limit); EAS build + Firebase config files for mobile push & native video.
```
