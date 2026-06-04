# Environment API Configuration

This document lists API-related environment variables. Secrets are redacted; keep real values in the .env file.

## Supabase
- SUPABASE_URL: https://vlcbwrfydjjnsjtuismw.supabase.co
- SUPABASE_ANON_KEY: <redacted>
- SUPABASE_SERVICE_ROLE_KEY: <redacted>

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
- CORS_ORIGIN: http://localhost:3000,http://localhost:5173
