# Native Mobile Production Plan

## Current Direction

The production mobile app lives in:

```text
Frontend/Mobile
```

It is a real Expo React Native app, separate from the older mobile web demo in:

```text
Frontend/App
```

The web app and native mobile app both connect to the same Express backend:

```text
Web app        -> Backend API -> MongoDB Atlas
Native mobile  -> Backend API -> MongoDB Atlas
```

MongoDB is never accessed directly from the browser or mobile app.

## Native Mobile Stack

- Expo SDK 56
- React Native
- TypeScript
- React Navigation
- Expo SecureStore for token/session storage
- Expo Notifications for device notification permissions/tokens
- Firebase Cloud Messaging through backend Firebase Admin support
- Daily.co native package foundation for video consultation rooms
- EAS Build for Android/iOS builds
- EAS Submit for app store submission

## Local Development

Install dependencies:

```bash
npm run install:mobile
npm run deps:mobile:fix
```

Start Expo dev client:

```bash
npm run dev:mobile
```

Start Expo Go mode:

```bash
npm run dev:mobile:expo-go
```

Important:

Expo Go can test basic screens and API calls, but native Daily.co modules require a development build.

## Local Phone Testing

Use the laptop LAN IP, not `localhost`, in:

```text
Frontend/Mobile/.env
```

Example:

```text
EXPO_PUBLIC_API_BASE_URL=http://10.65.171.27:5000
```

Backend must be running on the same network:

```bash
npm run dev:backend
```

## Production API Requirement

For production builds, use HTTPS:

```text
EXPO_PUBLIC_API_BASE_URL=https://api.your-domain.com
```

Do not use MongoDB, Daily, Resend, JWT, OTP, or Firebase Admin secrets in mobile env files.

## EAS Setup

Login:

```bash
npx eas login
```

Initialize EAS:

```bash
cd Frontend/Mobile
npx eas init
```

Build Android preview APK:

```bash
npm run build:android:preview
```

Build Android production:

```bash
npm run build:android:production
```

Build iOS production:

```bash
npm run build:ios:production
```

Submit Android:

```bash
npm run submit:android
```

Submit iOS:

```bash
npm run submit:ios
```

## Keys Still Needed For Full Production

Backend:

- DAILY_API_KEY
- RESEND_API_KEY
- FCM_PROJECT_ID
- FCM_CLIENT_EMAIL
- FCM_PRIVATE_KEY
- JWT_SECRET
- OTP_HASH_SECRET
- Production MONGODB_URI

Mobile:

- EXPO_PUBLIC_API_BASE_URL
- EAS_PROJECT_ID
- EXPO_UPDATE_URL if using EAS Update
- GOOGLE_SERVICES_JSON path for Android push builds
- GOOGLE_SERVICE_INFO_PLIST path for iOS push builds

## Role Scope

Native mobile app:

- Patient
- Doctor

Web app:

- Patient
- Doctor
- Admin
- Management

Admin and management should stay web-first because those screens are dashboard-heavy and operational.
