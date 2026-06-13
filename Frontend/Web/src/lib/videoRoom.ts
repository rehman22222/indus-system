// Resolve (create or reuse) the video consultation room for an appointment via
// the backend. The backend keeps it idempotent so the doctor and patient always
// receive short-lived, role-specific access to the same private consultation.

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000';

export interface VideoRoom {
  url: string;
  name: string;
  provider?: string;
}

export async function getOrCreateVideoRoom(appointmentId: string): Promise<VideoRoom> {
  const token = (() => {
    try {
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  })();

  const res = await fetch(`${API_BASE_URL}/api/v1/video/create-room`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ appointmentId }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Could not start the video room');
  }
  if (!data.room?.url) {
    throw new Error('Video room URL missing from server response');
  }
  return data.room as VideoRoom;
}
