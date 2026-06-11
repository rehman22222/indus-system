# Environment API Configuration

This document lists API-related environment variables. Secrets are redacted; keep real values in the .env file.

## MongoDB Atlas
- MONGODB_URI: <redacted>
- MONGODB_DB_NAME: doctorappointment

MongoDB credentials are backend/analytics secrets only. Do not add MongoDB URI,
database users, or database passwords to web/mobile frontend env files.

## Daily.co Video
- DAILY_API_URL: https://api.daily.co/v1
- DAILY_API_KEY: <redacted>

## Firebase Cloud Messaging (Optional)
- FCM_SERVER_KEY: <redacted>
- FCM_PROJECT_ID: your_firebase_project_id_here
- FCM_CLIENT_EMAIL: your_firebase_client_email_here
- FCM_PRIVATE_KEY: <redacted>

## Email Service (Resend)
- RESEND_API_KEY: <redacted>
- SMTP_HOST: smtp.resend.com
- SMTP_PORT: 465
- SMTP_USER: resend
- SMTP_PASS: <redacted>
- OTP_FROM_EMAIL: onboarding@resend.dev
- OTP_FROM_NAME: INDUS Hospital

## Analytics Service
- ANALYTICS_API_URL: http://localhost:8000

## CORS
- CORS_ORIGINS: http://localhost:3000,http://localhost:5173,http://localhost:3001

## Native Expo Mobile App
- EXPO_PUBLIC_API_BASE_URL: https://api.your-domain.com
- EXPO_PUBLIC_APP_NAME: Indus Hospital
- EAS_PROJECT_ID: <configured after `eas init`>
- EXPO_UPDATE_URL: <configured after EAS Update>

Native mobile env values with `EXPO_PUBLIC_` are public. Keep Daily.co,
Resend, Firebase Admin, JWT, OTP, and MongoDB secrets in backend env only.
