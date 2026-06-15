# INDUS Hospital — Smart Appointment & Consultation System
## Architecture Reference

_Last updated: 2026-06-15_

This document describes the **current** architecture of the system: every major
component, how they talk to each other, the data model, the realtime/video/
notification pipelines, and the deployment topology.

---

## 1. What the system is

A smart hospital appointment + tele‑consultation platform with **four roles**
(Patient, Doctor, Management, Admin), real‑time video consultations, queue
management, prescriptions, document sharing, push/email reminders, and an ML
analytics layer (no‑show prediction, demand forecasting, explainability).

- **Web app** — all 4 roles (Patient, Doctor, Management, Admin).
- **Mobile app (Android/iOS, Expo)** — Patient + Doctor.
- **Backend API** — one Node/Express service shared by web + mobile.
- **Analytics service** — Python/FastAPI (ML).
- **Data** — MongoDB Atlas (single shared database).

---

## 2. High-level diagram

```
                ┌──────────────────────────────────────────────────────────┐
                │                        CLIENTS                            │
                │                                                           │
   Web (Vite/React, 4 roles)            Mobile (Expo, Patient + Doctor)     │
   - PatientApp / DoctorApp             - Patient tabs + Doctor screens     │
   - AdminPortal / ManagementPortal     - Native Agora video               │
   - VideoCallRoom (Agora Web SDK)      - expo-notifications (FCM)          │
                │                                   │                       │
                └───────────────┬───────────────────┘                       │
                                │  HTTPS REST + WebSocket (Socket.IO)        │
                                ▼                                            │
                ┌──────────────────────────────────────────────────────────┐
                │              BACKEND  (Node + Express, ESM)               │
                │  Auth(JWT+OTP) · REST routes · Socket.IO · Workers        │
                │  ┌────────────┬─────────────┬───────────────┬──────────┐  │
                │  │ Realtime   │ Notif queue │ Reminder cron │ Video    │  │
                │  │ (Socket.IO)│ (worker)    │ (scheduler)   │ (Agora)  │  │
                │  └────────────┴─────────────┴───────────────┴──────────┘  │
                └───┬───────────┬───────────┬───────────┬───────────┬───────┘
                    │           │           │           │           │
                    ▼           ▼           ▼           ▼           ▼
              MongoDB Atlas  Upstash     Brevo       Firebase     Agora
              (data)         Redis       (email/OTP) FCM (push)   (RTC video)
                                │
                                ▼
                         Analytics service (FastAPI, Python)
                         no-show XGBoost · Prophet · SHAP   ← backend proxies via ANALYTICS_API_URL
```

---

## 3. Components

### 3.1 Backend API — `Backend/`
**Stack:** Node.js, Express (ESM modules), Mongoose 8, Socket.IO, JWT, `firebase-admin`, `agora-token`, `nodemailer`/Brevo/Resend, `redis` + `@socket.io/redis-adapter`.

**Entry:** `src/server.js` (single process) or `src/cluster.js` (one worker per CPU; requires `SOCKET_IO_REDIS_URL` for cross-worker realtime). Listens on `PORT` (5000 local, 10000 on Render).

**Layers**
- `src/routes/*` — Express routers (one per domain).
- `src/controllers/*` — request handlers / business logic.
- `src/models/index.js` — all Mongoose schemas (see §4).
- `src/services/*` — cross-cutting services (realtime, cache, email, push, OTP, Agora, notification queue, reminder scheduler, password).
- `src/middleware/*` — `auth.js` (JWT verify + `requireRole`), `errorHandler.js`, `validator.js`, `rateLimitStore.js`.
- `src/config/*` — `env.js` (validated env), `mongodb.js` (connection).
- `src/utils/*` — `api.js` (list/paging/projection), `mongo.js` (serialize / ObjectId).
- `src/scripts/*` — seeders, index ensure, slot repair, load test.

**Route surface** (mounted in `server.js`):
| Prefix | Purpose |
|---|---|
| `/api/auth` | login, send-otp, verify-otp, resend-otp |
| `/api/v1/otp` | OTP utilities |
| `/api/v1/video` | create-room, agora-token, context, prescription, decline |
| `/api/v1/notifications` | list, register-device, send, send-bulk, **test** |
| `/api/v1/analytics` | proxy to FastAPI analytics |
| `/api/v1/appointments` | CRUD + status transitions |
| `/api/v1/doctors`, `/departments`, `/patients` | directory + profiles |
| `/api/v1/queue` | live queue |
| `/api/v1/slots` | availability |
| `/api/v1/prescriptions` | prescriptions |
| `/api/v1/documents` | medical reports / past prescriptions (base64) |
| `/api/v1/admin`, `/api/v1/management` | role dashboards / governance |
| `/api/v1/data` | legacy compatibility fallback |
| `/health` | liveness + dependency status |

### 3.2 Web app — `Frontend/Web/`
**Stack:** React 18 + Vite + TypeScript, Tailwind CSS + shadcn/Radix UI, React Router, TanStack Query, `socket.io-client`, `agora-rtc-sdk-ng` (Web RTC SDK), `qrcode.react`.

**Supabase-compatible Mongo shim:** `src/integrations/mongodb/client.ts` exposes a `MongoDB.from('collection').select()/insert()/update()…` API plus auth + realtime, talking to the backend over REST/WebSocket. Hooks (`src/hooks/use*.tsx`) wrap it per domain.

**Pages (`src/pages/`):**
- `Index.tsx` — role landing page.
- `PatientApp.tsx` — patient portal (Home / Appointments / **Book** / History / Profile). Booking now has rich doctor cards + "Book Now", visit type, medical history, **report/prescription upload**, QR, video join.
- `DoctorApp.tsx` — doctor portal (queue, schedule, prescriptions, start video → opens `/video-call`).
- `AdminPortal.tsx`, `ManagementPortal.tsx` — admin/management dashboards.
- `VideoCallRoom.tsx` — `/video-call?token=…` consultation page: Agora video **+ clinical workspace** (patient history, files, prescription). Handles `call:declined`.
- `CheckInKiosk.tsx`, `AgoraTest.tsx`, `ResetPassword.tsx`, `NotFound.tsx`, `PatientMobileOnly.tsx`.

**Components:** `components/{admin,management,doctor,patient,shared,ui}` — `ui/` is shadcn primitives; `shared/` has `DashboardLayout`, `VideoCall`, `AgoraCall`.

### 3.3 Mobile app — `Frontend/Mobile/`
**Stack:** Expo SDK 54, React Native 0.81, React 19, React Navigation (native-stack + bottom-tabs), `react-native-agora` (native RTC), `expo-notifications` (FCM), `expo-secure-store` (tokens), `socket.io-client`, custom Theme (light/dark) + i18n (EN/Urdu RTL).

**Roles:** Patient + Doctor (`RootNavigator` switches stack by `user.role`).

**Structure (`src/`):**
- `api/` — `client.ts` (fetch wrapper, remote-aware timeout), `auth.ts`, `domain.ts`, `documents.ts`, `notifications.ts`, `types.ts`.
- `screens/patient/` — Home, Appointments, **Doctors** (Book Appointment → pre-selects doctor), Book, History, Profile, AppointmentDetails.
- `screens/doctor/` — Home, Appointment (clinical workspace).
- `screens/shared/` — `NativeVideoCallScreen` (Agora), `VideoCallScreen`.
- `services/` — `realtime.ts` (Socket.IO), `video.ts`, `notifications.ts`.
- `components/` — `IncomingCallProvider` (rings on `call:incoming`), `PortalHeader`, `DarkModeToggle`, QR card.
- `config/env.ts` — resolves API base URL (Render https wins; else LAN IP from Metro).
- Build: EAS (`eas.json`), `app.config.ts`. The **preview/production APK** bakes `EXPO_PUBLIC_API_BASE_URL=https://indus-system.onrender.com`.

### 3.4 Analytics service — `Backend/analytics/` (Python / FastAPI)
ML microservice: **no-show prediction (XGBoost)**, **demand forecasting (Prophet)**, **explainability (SHAP)**, realtime dashboard, scheduler. Runs on `:8000`; the Node backend reaches it via `ANALYTICS_API_URL` and exposes it through `/api/v1/analytics`. Folders: `api/`, `models/`, `data/`, `explainability/`, `realtime_dashboard/`, `scheduler/`, `saved_models/`.

---

## 4. Data model (MongoDB, `src/models/index.js`)

Single shared Atlas database. 14 collections:

| Model | Purpose / key fields |
|---|---|
| **User** | auth identity; `role`, `email`, `password_hash`, `name`, `phone`, `gender`, `medical_history`, `fcm_token`, `push_tokens[]` |
| **Department** | specialties; `head_doctor_id` |
| **Doctor** | profile; `user_id`, `name`, `specialty`, `qualification`, `experience_years`, `consultation_fee`, `available_days`, `daily_video_quota` |
| **Slot** | availability; `doctor_id`, `date`, `start_time`, `is_available` (unique per doctor/date/time) |
| **Appointment** | `patient_id`(User), `doctor_id`, `slot_id`, `date`, `time`, `status`, `appointment_type` (physical/video), `visit_type` (new/follow_up), `chief_complaint`, `history_summary`, `token`, `video_room_*`, `reminders_sent[]`, consult timestamps |
| **Prescription** | `appointment_id`, `doctor_id`, `patient_id`, `diagnosis`, `medications[]`, `instructions`, `follow_up_date` |
| **MedicalRecord** | longitudinal patient records |
| **MedicalDocument** | uploaded reports / past prescriptions (base64 blob), `kind`, linked to appointment |
| **QueueEntry** | live waiting-room queue |
| **Notification** | in-app notifications; `user_id`, `title`, `body`, `data`, `read`, `fcm_message_id` |
| **AnalyticsEvent** | event log for analytics |
| **AuditLog** | governance / audit trail |
| **SystemSetting** | configurable settings |
| **AppointmentRule** | booking rules/governance |

> `Database/*.sql` are legacy schema references from an earlier SQL prototype; the live store is MongoDB.

---

## 5. Authentication & authorization

- **Login:** `POST /api/auth/login` → bcrypt/scrypt verify → **JWT** (`JWT_SECRET`, 24h) returned to client. Web stores it in `localStorage` (`auth_token`); mobile in `expo-secure-store`.
- **Patient self sign-up:** email **OTP** — `send-otp` (emails a 6-digit code, scrypt-hashed + stored with expiry in Mongo) → `verify-otp` (creates the User + Patient, returns JWT). Doctors/staff get credentials from admin.
- **Every API request:** `Authorization: Bearer <jwt>`; `middleware/auth.js` verifies and sets `req.user` + `req.userRole`; `requireRole([...])` guards role-specific routes.
- **Socket.IO:** the JWT is passed in the handshake `auth.token`; the server joins each socket to a private `user:<userId>` room for targeted events.

---

## 6. Realtime architecture (Socket.IO)

`src/services/realtime.service.js` runs the Socket.IO server.

- **Rooms:** `user:<id>` (per user), `doctor:<id>` / `queue` (queue updates), `video:<appointmentId>` (signalling).
- **Events:** `call:incoming`, `call:declined`, `notification:new`, `video.join/peer-joined/peer-left/signal/ended`, queue events.
- **Scaling / cross-backend:** if `SOCKET_IO_REDIS_URL` is set, a **Redis adapter (Upstash)** bridges all server instances. This is what lets a **doctor on the local backend ring a patient on the Render backend** — both join the same Redis pub/sub bus. Without it, Socket.IO is in-memory per instance (fine for a single backend).

```
Doctor (web) ──create-room──▶ Backend A ──emit call:incoming──▶ Redis ──▶ Backend B ──▶ Patient socket (APK) rings
                                                                 (Upstash shared bus)
```

---

## 7. Video consultations (Agora)

- **Provider:** Agora RTC. `VIDEO_PROVIDER=agora` (webrtc/jitsi/daily retained as fallbacks).
- **Tokens:** `src/services/agora.service.js` mints RTC tokens with `agora-token`. With **App ID only** (no certificate) it runs in token-less mode (`token: null`); with `AGORA_APP_CERTIFICATE` it signs per-channel tokens. Channel derived from the appointment id.
- **Web doctor/patient:** `agora-rtc-sdk-ng` inside `AgoraCall`/`VideoCallRoom`.
- **Mobile patient:** native `react-native-agora` in `NativeVideoCallScreen`.
- **Flow:** doctor starts call → `POST /api/v1/video/create-room` → backend rings the patient (`call:incoming`) and returns the signed `/video-call?token=…` URL (which embeds the clinical workspace) → patient accepts → both join the Agora channel (media flows through Agora's cloud, **not** our backend). Decline → `call:declined` cuts the doctor's call tab and shows the reason.

---

## 8. Notifications & reminders

Three delivery channels, decoupled from the request path:

1. **In-app** — `Notification` documents + live `notification:new` socket ping.
2. **Push (FCM)** — `src/services/push.service.js` (`firebase-admin`). Device tokens registered via `POST /api/v1/notifications/register-device` (mobile auto-registers on login). Delivery is queued through `notificationQueue.service.js` (Redis list or in-memory worker).
3. **Email** — `src/services/email.service.js`, provider selected by `EMAIL_PROVIDER`:
   - **`brevo`** — HTTPS API (**required on Render**, which blocks outbound SMTP). Verify one sender, send to anyone.
   - `smtp` — Gmail etc. (works locally; blocked on Render).
   - `resend` — HTTPS API (needs a verified domain for arbitrary recipients).
   Used for OTP codes and appointment confirmations.

**Appointment reminder scheduler** — `src/services/reminderScheduler.service.js`:
- Ticks every `REMINDER_CHECK_INTERVAL_SECONDS` (default 60s).
- Fires **2 h before**, **30 min before**, and **at start time** → in-app + FCM push to the patient.
- **Exactly-once** via an atomic `reminders_sent` claim (safe across multiple instances).
- **Timezone-safe** via `CLINIC_UTC_OFFSET_MINUTES` (default 300 = PKT), so naive `date`/`time` strings fire correctly whether the server clock is PKT (dev) or UTC (Render).
- ⚠️ A sleeping free Render instance pauses the scheduler — keep it warm (uptime pinger on `/health`) for reliable reminders.

---

## 9. End-to-end clinical data flow (booking → consultation)

```
Patient books (web or mobile)
  → Appointment {visit_type, chief_complaint, history_summary} + MedicalDocuments (reports/Rx, base64)
  → reminder scheduler queues 2h/30m/start pushes
Doctor opens the appointment
  → Clinical workspace shows demographics, chief complaint, history_summary, allergies,
    uploaded documents, and prior visits/prescriptions
  → Doctor starts video (rings patient) and writes the Prescription (diagnosis, meds, instructions, follow-up)
Patient
  → sees the prescription in History; gets reminders + the QR token for physical check-in
```

All of this rides the single Atlas DB, so web and mobile stay in sync regardless of which client created the data.

---

## 10. Deployment topology

| Concern | Where | Notes |
|---|---|---|
| Backend API | **Render** Web Service (Node, free tier) | `https://indus-system.onrender.com`, port 10000; cold-starts after idle |
| Database | **MongoDB Atlas** | shared by all environments; IP allowlist |
| Realtime bus | **Upstash Redis** (`rediss://`) | `SOCKET_IO_REDIS_URL` on both local + Render to bridge realtime |
| Email | **Brevo** (HTTPS API) | `EMAIL_PROVIDER=brevo` on Render (SMTP is blocked there) |
| Push | **Firebase FCM** | `FCM_*` env vars on Render (service-account JSON is gitignored) |
| Video | **Agora** | App ID public; certificate optional/secret |
| Mobile APK | **EAS Build** | `preview` profile bakes the Render URL; install on any phone |
| Analytics | local / separate host | reached via `ANALYTICS_API_URL` |

**Dev vs prod topology:** the installed **APK → Render**; **local web + Expo Go → local backend** (`http://<LAN-ip>:5000`). Both backends share the same Atlas DB and (via Upstash) the same Socket.IO bus, so cross-backend calling/reminders work. The web portal can be pointed at Render on demand with `npm run dev:render`.

---

## 11. Configuration (key env vars, `Backend/.env`)

```
PORT, NODE_ENV, MONGODB_URI, JWT_SECRET, OTP_HASH_SECRET
CORS_ORIGINS / CORS_ORIGIN
EMAIL_PROVIDER (brevo|smtp|resend), BREVO_API_KEY, OTP_FROM_EMAIL, OTP_FROM_NAME
SMTP_HOST/PORT/SECURE/USER/PASS, RESEND_API_KEY              # alt email providers
VIDEO_PROVIDER=agora, AGORA_APP_ID, AGORA_APP_CERTIFICATE
DOCTOR_CALL_WEB_BASE_URL, PATIENT_CALL_WEB_BASE_URL
REDIS_URL, SOCKET_IO_REDIS_URL                               # cache + socket bus (Upstash)
FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY            # or FIREBASE_SERVICE_ACCOUNT=file
REMINDER_SCHEDULER_ENABLED, REMINDER_CHECK_INTERVAL_SECONDS, CLINIC_UTC_OFFSET_MINUTES
ANALYTICS_API_URL
```
Frontend: `Frontend/Web/.env` (`VITE_API_BASE_URL`), `Frontend/Mobile/.env` + `eas.json` (`EXPO_PUBLIC_API_BASE_URL`).

> **Secrets** (Mongo URI, JWT secret, Brevo/Agora/FCM/Upstash keys) live only in gitignored env files / the Render dashboard — never committed. Rotate before real production.

---

## 12. Directory map (top level)

```
fyp/
├─ Backend/                 Node/Express API + Python analytics
│  ├─ src/{routes,controllers,models,services,middleware,config,utils,scripts}
│  └─ analytics/            FastAPI ML service
├─ Frontend/
│  ├─ Web/                  React + Vite (4 roles)
│  ├─ Mobile/               Expo app (Patient + Doctor)
│  └─ App/                  legacy/secondary app
├─ Database/                legacy SQL schema references
├─ docs/ , poster/ , scripts/
├─ architecture.md          ← this file
└─ project.md               change log / project notes
```

---

## 13. Tech stack summary

| Layer | Technology |
|---|---|
| Backend | Node.js, Express (ESM), Mongoose 8, Socket.IO, JWT |
| Database | MongoDB Atlas |
| Cache / realtime bus | Redis (Upstash) — optional, in-memory fallback |
| Web | React 18, Vite, TypeScript, Tailwind, shadcn/Radix, TanStack Query, React Router |
| Mobile | Expo SDK 54, React Native 0.81, React Navigation, react-native-agora, expo-notifications |
| Video | Agora RTC (web SDK + native) |
| Email | Brevo (HTTPS) / SMTP / Resend |
| Push | Firebase Cloud Messaging |
| Analytics | Python, FastAPI, XGBoost, Prophet, SHAP |
| Hosting | Render (API), MongoDB Atlas, Upstash, EAS Build (APK) |

---

## 14. Key design decisions & constraints

- **One backend, one DB** for web + mobile → consistent data everywhere.
- **Realtime needs a shared bus** across instances → Upstash Redis adapter bridges local↔Render.
- **Render blocks outbound SMTP** → email goes over an HTTPS API (Brevo).
- **Agora media bypasses the backend** → only the *ring* signal needs the shared Socket.IO bus; video scales independently.
- **Reminders are timezone-safe + idempotent** → correct on UTC hosts, never double-sent.
- **Mobile API base URL auto-resolves** → APK uses Render; Expo Go follows the dev machine's LAN IP (no manual edits).
