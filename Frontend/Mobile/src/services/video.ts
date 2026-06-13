import { Linking } from 'react-native';
import * as ExpoLinking from 'expo-linking';

import { apiRequest } from '@/api/client';

export type VideoRoom = {
  url: string;
  name: string;
  provider?: string;
};

/**
 * Resolve (create or reuse) the consultation room for an appointment via the
 * backend. The default is an appointment-scoped browser WebRTC room, with no
 * hosted video-provider account or API key required.
 */
export async function createVideoRoom(appointmentId: string): Promise<VideoRoom> {
  const response = await apiRequest<{ room: VideoRoom }>('/api/v1/video/create-room', {
    method: 'POST',
    body: JSON.stringify({ appointmentId }),
  });

  return response.room;
}

/**
 * Open the consultation in the device's browser. The browser handles camera
 * and microphone permissions, so this works from Expo Go without a native
 * WebRTC module.
 */
export async function openVideoConsultation(appointmentId: string): Promise<void> {
  const room = await createVideoRoom(appointmentId);
  await openRoomUrl(room.url);
}

/** Open a known room URL directly (e.g. from an incoming-call payload). */
export async function openRoomUrl(url: string): Promise<void> {
  let safeUrl: URL;
  try {
    safeUrl = new URL(url);
  } catch {
    throw new Error('The video consultation link is invalid. Please ask the doctor to start the call again.');
  }
  const isPrivateDevelopmentHost =
    safeUrl.hostname === 'localhost' ||
    safeUrl.hostname === '127.0.0.1' ||
    /^10\./.test(safeUrl.hostname) ||
    /^192\.168\./.test(safeUrl.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(safeUrl.hostname);
  const isAllowedDevelopmentUrl = safeUrl.protocol === 'http:' && isPrivateDevelopmentHost;
  if (safeUrl.protocol !== 'https:' && !isAllowedDevelopmentUrl) {
    throw new Error('The video consultation link is not secure. Please ask the doctor to start the call again.');
  }

  // The browser call cannot close its Safari tab programmatically. Give it a
  // verified deep link so ending the call returns to Expo Go during development
  // and to the installed Indus app in production builds.
  safeUrl.searchParams.set('returnUrl', ExpoLinking.createURL('/appointment-ended'));
  safeUrl.searchParams.set('source', 'mobile');

  const canOpen = await Linking.canOpenURL(safeUrl.toString());
  if (!canOpen) throw new Error('No browser available to open the video consultation');
  await Linking.openURL(safeUrl.toString());
}

/** Tell the doctor the patient declined the incoming call (with a reason). */
export async function declineVideoCall(appointmentId: string, reason?: string): Promise<void> {
  await apiRequest('/api/v1/video/decline', {
    method: 'POST',
    body: JSON.stringify({ appointmentId, reason: reason || '' }),
  });
}
