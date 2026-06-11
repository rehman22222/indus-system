# Indus Hospital Smart Appointment System

## Credentials And Access Guide

**Last updated:** June 8, 2026  
**Purpose:** Local testing, demo access, and production key checklist.

Important:

- Do not put MongoDB URI, JWT secret, OTP secret, Resend key, Daily key, or Firebase private key in frontend/mobile files.
- Backend and analytics connect to MongoDB.
- Web and mobile apps connect only to the backend API.
- Real secret values are intentionally not written in this document.

---

## Local URLs

```text
Backend API:      http://localhost:5000
Web app:          http://localhost:5173
Mobile web demo:  http://localhost:3001 (patient only)
Analytics API:    http://localhost:8000
Native mobile:    Frontend/Mobile through Expo (patient only)
```

Phone testing backend URL:

```text
http://10.65.171.27:5000
```

---

## Demo Role Credentials

All demo users use:

```text
Password: 123456
```

## Admin

```text
URL:      http://localhost:5173/admin
Email:    admin@gmail.com
Password: 123456
```

## Management

```text
URL:      http://localhost:5173/management
Email:    management1@indus.org.pk
Password: 123456
```

## Doctor

```text
Web URL:  http://localhost:5173/doctor
Email:    doctor1@indus.org.pk
Password: 123456
```

## Patient

```text
Mobile web URL: http://localhost:3001
Native mobile:  Frontend/Mobile
Web note:       http://localhost:5173/patient redirects to mobile-app guidance
Email:          patient1@example.com
Password:       123456
```

## Video Consultation Demo Patients

Use these patients to test video appointment data with `doctor1@indus.org.pk`.

```text
Doctor:   doctor1@indus.org.pk
Password: 123456
Date:     2026-06-08
```

```text
Patient:  Fatima Noor
Email:    video.patient1@example.com
Password: 123456
Token:    VID-20260608-001
Status:   waiting
Type:     video
```

```text
Patient:  Hamza Ahmed
Email:    video.patient2@example.com
Password: 123456
Token:    VID-20260608-002
Status:   confirmed
Type:     video
```

```text
Patient:  Sana Iqbal
Email:    video.patient3@example.com
Password: 123456
Token:    VID-20260608-003
Status:   in_consultation
Type:     video
```

---

## Backend Environment Status

File:

```text
Backend/.env
```

Configured locally:

```text
PORT
NODE_ENV
OTP_DEV_MODE
MONGODB_URI
MONGODB_DB_NAME
MONGODB_AUTO_INDEX
RESEND_API_KEY
OTP_FROM_EMAIL
OTP_FROM_NAME
OTP_EXPIRY_MINUTES
ANALYTICS_API_URL
CORS_ORIGIN
CORS_ORIGINS
```

Still needed before production:

```text
DAILY_API_KEY
FCM_PROJECT_ID
FCM_CLIENT_EMAIL
FCM_PRIVATE_KEY
Strong production JWT_SECRET
Strong production OTP_HASH_SECRET
Production HTTPS API domain
```

Optional for production scaling:

```text
REDIS_URL
SOCKET_IO_REDIS_URL
```

---

## Native Mobile Environment Status

File:

```text
Frontend/Mobile/.env
```

Configured locally:

```text
EXPO_PUBLIC_API_BASE_URL=http://10.65.171.27:5000
EXPO_PUBLIC_APP_NAME="Indus Hospital"
```

Needed for production mobile builds:

```text
EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com
EAS_PROJECT_ID
EXPO_OWNER
EXPO_UPDATE_URL
GOOGLE_SERVICES_JSON
GOOGLE_SERVICE_INFO_PLIST
```

Important:

`EXPO_PUBLIC_*` values are public. Never place backend secrets there.

---

## Web Frontend Environment Status

File:

```text
Frontend/Web/.env
```

Configured locally:

```text
VITE_API_BASE_URL=http://localhost:5000
VITE_API_URL=http://localhost:5000
VITE_ML_API_URL=http://localhost:8000
```

Optional later:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
VITE_DAILY_API_KEY
```

---

## Analytics Environment Status

File:

```text
Backend/Analytics/.env
```

Configured locally:

```text
MONGODB_URI
MONGODB_DB_NAME
USE_MOCK_DATA=false
CORS_ORIGINS
```

Optional:

```text
ANALYTICS_API_KEY
REDIS_URL
```

---

## Production Key Checklist

## Daily.co

Needed for real online consultation rooms:

```text
DAILY_API_KEY
```

Put it in:

```text
Backend/.env
```

## Firebase Admin

Needed for push notifications:

```text
FCM_PROJECT_ID
FCM_CLIENT_EMAIL
FCM_PRIVATE_KEY
```

Put them in:

```text
Backend/.env
```

## Firebase Mobile Files

Needed for native mobile push builds:

```text
Frontend/Mobile/google-services.json
Frontend/Mobile/GoogleService-Info.plist
```

These files are git-ignored.

## JWT And OTP Secrets

Generate strong secrets:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

Use one generated value for:

```text
JWT_SECRET
```

Generate another different value for:

```text
OTP_HASH_SECRET
```

Put both in:

```text
Backend/.env
```

## EAS Mobile Builds

Needed for Android/iOS builds:

```text
Expo account
EAS_PROJECT_ID
EXPO_OWNER
Google Play developer account
Apple developer account
```

Commands:

```bash
cd Frontend/Mobile
npx eas login
npx eas init
npm run build:android:preview
```

---

## Quick Start Commands

Backend:

```bash
npm run dev:backend
```

Web:

```bash
npm run dev:web
```

Mobile web demo:

```bash
npm run dev:app
```

Native mobile:

```bash
npm run dev:mobile
```

Analytics:

```bash
npm run dev:analytics
```

Verify native mobile:

```bash
npm run verify:mobile
```
