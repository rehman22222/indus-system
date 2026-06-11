# Indus Hospital Native Mobile App

Production native mobile app for patient and doctor flows.

## Stack

- Expo SDK 56 + React Native
- TypeScript
- React Navigation
- Expo SecureStore
- Expo Notifications
- Daily.co native room support
- Shared Express backend API
- EAS Build / EAS Submit

## Backend Contract

The app connects only to the backend:

```text
EXPO_PUBLIC_API_BASE_URL=https://api.your-domain.com
```

MongoDB, Daily.co, Resend, Firebase Admin, JWT, and OTP secrets stay on the backend.

## Local Start

```bash
npm install
npm run start
```

For Expo Go only:

```bash
npm run start:expo-go
```

Native Daily.co support requires a development build:

```bash
npm run build:android:preview
```

## Demo Credentials

```text
Patient: patient1@example.com / 123456
Doctor: doctor1@indus.org.pk / 123456
```

Admin and management use the web app.
