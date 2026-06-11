# Mobile App Testing (Full APK build)

How to build and test the native patient app (`Frontend/Mobile/`, Expo + React
Native) as a real Android APK so you can verify the features that **do not work
in Expo Go**: FCM push notifications, device-token registration, camera/mic +
Jitsi video, and production-like behaviour.

---

## What you can test in each mode

| Feature | Expo Go (`npm run start:expo-go`) | Preview APK (EAS build) |
|---|---|---|
| Login / appointments / booking | ✅ | ✅ |
| Realtime queue (Socket.IO) | ✅ | ✅ |
| **FCM push notifications** | ❌ | ✅ |
| **Device-token registration** | ❌ | ✅ |
| **Camera/mic + Jitsi video** | ⚠️ opens browser | ✅ opens browser (real perms) |
| Production-like behaviour | ❌ | ✅ |

> Patient video uses Jitsi opened in the device browser (`Linking.openURL`), so
> camera/mic are granted by the browser/Jitsi — that's why it works without a
> native video module. (An in-app WebView is available on request.)

---

## Prerequisites (already configured in the repo)

- `Frontend/Mobile/google-services.json` (Firebase, package `com.indushospital.appointment`).
- `app.config.ts`: package name matches Firebase, `expo-build-properties` allows
  cleartext HTTP (so the APK can reach the LAN backend), camera/mic/notification permissions.
- `eas.json`: `EXPO_PUBLIC_API_BASE_URL` baked into the `development` + `preview`
  profiles (the gitignored `.env` is **not** uploaded to EAS — env must live in `eas.json`).
- Backend has Firebase Admin initialised (`fyp-indushospital`) and the
  `register-device` + notification-send endpoints.

You need: a free **Expo account** (https://expo.dev), and the backend + analytics
running on your PC.

---

## Step 0 — Make the backend reachable from the phone

The APK talks to `http://192.168.1.45:5000` (your PC's LAN IP). Phone and PC must
be on the **same Wi-Fi**.

1. Confirm the IP is still correct (`ipconfig` → IPv4). If it changed, update
   `EXPO_PUBLIC_API_BASE_URL` in **both** `Frontend/Mobile/.env` and
   `Frontend/Mobile/eas.json`, and rebuild.
2. Open the firewall once (Admin PowerShell):
   ```powershell
   New-NetFirewallRule -DisplayName "HMS Backend 5000" -Direction Inbound `
     -Action Allow -Protocol TCP -LocalPort 5000 -Profile Private
   ```
3. Sanity check from the phone's browser: open `http://192.168.1.45:5000/health`
   → should return JSON.

> Off-Wi-Fi / cellular testing? Run an HTTPS tunnel instead
> (`cloudflared tunnel --url http://localhost:5000`), put that `https://…` URL in
> `eas.json` + `.env`, and rebuild. HTTPS also removes the cleartext requirement.

---

## Step 1 — Upload Firebase config as an EAS secret

`google-services.json` is gitignored, so EAS won't include it in the build unless
you provide it as a secret. `app.config.ts` reads `process.env.GOOGLE_SERVICES_JSON`.

```bash
cd Frontend/Mobile
npx eas login
npx eas init                      # creates/links the EAS project (sets projectId)
npx eas secret:create --scope project --name GOOGLE_SERVICES_JSON \
  --type file --value ./google-services.json
```

(Verify later with `npx eas secret:list`.)

---

## Step 2 — Build the preview APK

```bash
cd Frontend/Mobile
npm run build:android:preview      # = eas build --platform android --profile preview
```

- Runs in the cloud (~10–20 min). When done, EAS prints a **download URL** (and a QR).
- Download the `.apk` to the phone and install it (allow "install from unknown
  sources" if prompted).

---

## Step 3 — Run it

The preview build is a standalone APK — just open the **Indus Hospital** app.
(You don't need Metro for a preview build; Metro/`npm run start` is only for the
`development` dev-client profile.)

Demo login:
```
Patient: patient1@example.com / 123456
```

---

## Step 4 — Test each feature

### A. Device-token registration ✅
1. Log in. On first launch the app asks for **notification permission** → Allow.
2. The app calls `POST /api/v1/notifications/register-device` with the native FCM
   token. Confirm in the **backend console** you see the request (200), or check
   the user's `push_tokens` in MongoDB.

### B. FCM push notifications ✅
1. With the app logged in (and backgrounded), trigger a notification:
   - Easiest: **book/confirm a video appointment** for that patient (the backend
     enqueues a push), **or**
   - Call the API directly:
     ```bash
     # get an admin/staff token, then:
     curl -X POST http://localhost:5000/api/v1/notifications/send \
       -H "Authorization: Bearer <staff_token>" -H "Content-Type: application/json" \
       -d '{"user_id":"<patientUserId>","title":"Test","body":"Hello from Indus"}'
     ```
2. The phone should receive the push banner (delivered by Firebase to the device token).

### C. Camera/mic + Jitsi video ✅
1. Open a **video** appointment → tap **Join Video Call**.
2. The phone opens `https://jitsi.riot.im/indus-appointment-<id>` in the browser /
   Jitsi app → it prompts for **camera & microphone** → Allow → you're in the call.
3. Join the **same** appointment as the doctor on the web (`/doctor` → Start Video
   Call) → two-way audio/video in the same room.

### D. Production-like behaviour ✅
Cold start, background/foreground, permission prompts, real network — all behave
like a published app (unlike Expo Go).

---

## Troubleshooting

- **"Network request failed" / can't log in** → backend not reachable. Check same
  Wi-Fi, the firewall rule, the IP in `eas.json`, and `http://<ip>:5000/health`
  from the phone browser. If you changed the IP, you must **rebuild** (the URL is
  baked into the APK).
- **No push received** → ensure notification permission was granted, the EAS
  `GOOGLE_SERVICES_JSON` secret exists (`eas secret:list`), the backend shows
  Firebase initialised, and the device token registered (Step 4A).
- **Build fails on missing google-services.json** → the EAS secret (Step 1) is
  missing or misnamed.
- **Video page blank** → tap again / check the phone has a browser; the room URL
  must be reachable (`jitsi.riot.im` is a public server).

---

## Notes / production hardening

- `usesCleartextTraffic: true` is for testing against an HTTP LAN backend. For a
  real release, deploy the backend over **HTTPS** and remove cleartext.
- `jitsi.riot.im` is a free third-party server. For a guaranteed-stable demo,
  self-host Jitsi (Docker) and point `JITSI_BASE_URL` at it.
- For Play Store distribution use the `production` profile (`eas build -p android
  --profile production`) + `eas submit`.
