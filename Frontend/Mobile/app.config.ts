import 'dotenv/config';
import fs from 'node:fs';
import type { ExpoConfig } from 'expo/config';

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  'http://localhost:5000';

// Only reference a Firebase config file when it actually exists, otherwise
// Expo fails to parse the config (e.g. a missing GoogleService-Info.plist).
const existing = (...candidates: (string | undefined)[]) =>
  candidates.find((p) => p && fs.existsSync(p));

const androidGoogleServicesFile = existing(process.env.GOOGLE_SERVICES_JSON, './google-services.json');
const iosGoogleServicesFile = existing(process.env.GOOGLE_SERVICE_INFO_PLIST, './GoogleService-Info.plist');

const config: ExpoConfig = {
  name: 'Indus Hospital',
  slug: 'indus-hospital-smart-appointment',
  scheme: 'indusappointment',
  owner: process.env.EXPO_OWNER || 'rana00',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  platforms: ['ios', 'android'],

  runtimeVersion: {
    policy: 'appVersion',
  },

  updates: {
    url: process.env.EXPO_UPDATE_URL,
    fallbackToCacheTimeout: 0,
  },

  extra: {
    apiBaseUrl,
    eas: {
      projectId:
        process.env.EAS_PROJECT_ID ||
        '2047113e-629a-4f79-8e98-85043713e3a6',
    },
  },

  ios: {
    bundleIdentifier: 'com.indushospital.appointment',
    googleServicesFile: iosGoogleServicesFile,
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        'Camera access is used for video consultations.',
      NSMicrophoneUsageDescription:
        'Microphone access is used for video consultations.',
      NSUserNotificationsUsageDescription:
        'Notifications are used for appointment and queue updates.',
    },
  },

  android: {
    package: 'com.indushospital.appointment',
    googleServicesFile: androidGoogleServicesFile,
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'POST_NOTIFICATIONS',
      'VIBRATE',
    ],
    adaptiveIcon: {
      backgroundColor: '#C93232',
    },
  },

  plugins: [
    'expo-secure-store',
    [
      'expo-notifications',
      {
        color: '#C93232',
        defaultChannel: 'appointments',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
};

export default config;