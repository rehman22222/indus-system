import { Linking } from 'react-native';

import { apiRequest } from '@/api/client';

export type VideoRoom = {
  url: string;
  name: string;
  provider?: string;
};

/**
 * Resolve (create or reuse) the consultation room for an appointment via the
 * backend. With VIDEO_PROVIDER=jitsi (default) this is a free Jitsi Meet URL —
 * no API key required.
 */
export async function createVideoRoom(appointmentId: string): Promise<VideoRoom> {
  const response = await apiRequest<{ room: VideoRoom }>('/api/v1/video/create-room', {
    method: 'POST',
    body: JSON.stringify({ appointmentId }),
  });

  return response.room;
}

/**
 * Open the consultation in the device's external browser (or the Jitsi app if
 * installed). Using the external browser means the OS handles camera/mic
 * permissions, so it works even in Expo Go with no native video module.
 */
export async function openVideoConsultation(appointmentId: string): Promise<void> {
  const room = await createVideoRoom(appointmentId);
  const canOpen = await Linking.canOpenURL(room.url);
  if (!canOpen) {
    throw new Error('No browser available to open the video consultation');
  }
  await Linking.openURL(room.url);
}
