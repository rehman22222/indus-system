import { getAccessToken } from '@/api/client';
import { env } from '@/config/env';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectRealtime() {
  if (socket?.connected) return socket;

  socket = io(env.apiBaseUrl, {
    transports: ['websocket'],
    auth: {
      token: getAccessToken(),
    },
  });

  return socket;
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}

export function joinDoctorQueue(doctorId?: string) {
  const client = connectRealtime();
  client.emit('queue.join', doctorId ? { doctor_id: doctorId } : {});
  return client;
}

export function leaveDoctorQueue(doctorId?: string) {
  socket?.emit('queue.leave', doctorId ? { doctor_id: doctorId } : {});
}

export function onQueueEvent(event: string, callback: (payload: unknown) => void) {
  const client = connectRealtime();
  client.on(event, callback);

  return () => {
    client.off(event, callback);
  };
}
