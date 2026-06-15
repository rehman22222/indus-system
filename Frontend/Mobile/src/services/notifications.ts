import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { apiRequest } from '@/api/client';

// Expo Go (SDK 53+) removed remote push notifications — the native push APIs
// only work in a development/preview build. Detect Expo Go so we skip them
// quietly instead of logging warnings/network errors.
const isExpoGo = Constants.executionEnvironment === 'storeClient';
type NotificationsModule = typeof import('expo-notifications');
let notificationsModule: NotificationsModule | null = null;

function getNotifications(): NotificationsModule | null {
  if (isExpoGo) return null;
  if (!notificationsModule) {
    notificationsModule = require('expo-notifications') as NotificationsModule;
  }
  return notificationsModule;
}

const initialNotifications = getNotifications();
if (initialNotifications) {
  initialNotifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

type DeviceTokenPayload = {
  token: string;
  provider: 'fcm' | 'apns' | 'expo' | 'unknown';
  platform: 'android' | 'ios' | 'web' | 'unknown';
  deviceName?: string;
};

function getProjectId() {
  return (
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    undefined
  );
}

function getPlatformProvider() {
  if (Platform.OS === 'android') return 'fcm';
  if (Platform.OS === 'ios') return 'apns';
  return 'unknown';
}

async function registerBackendToken(payload: DeviceTokenPayload) {
  return apiRequest('/api/v1/notifications/register-device', {
    method: 'POST',
    body: JSON.stringify({
      token: payload.token,
      provider: payload.provider,
      platform: payload.platform,
      deviceName: payload.deviceName,
    }),
  });
}

export async function registerForPushNotifications() {
  if (isExpoGo || !Device.isDevice) return null;
  const Notifications = getNotifications();
  if (!Notifications) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Appointments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C93232',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const finalPermission =
    current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();

  if (finalPermission.status !== 'granted') return null;

  const nativeToken = await Notifications.getDevicePushTokenAsync();
  const payload: DeviceTokenPayload = {
    token: String(nativeToken.data),
    provider: getPlatformProvider(),
    platform: Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : 'unknown',
    deviceName: Device.deviceName || undefined,
  };
  await registerBackendToken(payload);

  const projectId = getProjectId();
  if (projectId) {
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerBackendToken({
      token: expoToken.data,
      provider: 'expo',
      platform: payload.platform,
      deviceName: payload.deviceName,
    });
  }

  return payload.token;
}
