import { apiRequest, buildQuery } from '@/api/client';
import type { AppNotification } from '@/api/types';

export async function getNotifications(params: { page?: number; limit?: number; read?: boolean } = {}) {
  const response = await apiRequest<{ notifications?: AppNotification[]; data?: AppNotification[] }>(
    `/api/v1/notifications${buildQuery(params)}`,
  );

  return response.notifications || response.data || [];
}

export async function markNotificationRead(notificationId: string) {
  const response = await apiRequest<{ notification?: AppNotification; data?: AppNotification }>(
    `/api/v1/notifications/${notificationId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    },
  );

  return response.notification || response.data;
}
