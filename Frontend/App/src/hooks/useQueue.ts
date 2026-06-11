import { useCallback, useEffect, useState } from 'react';
import { MongoDB } from '@/integrations/mongodb/client';
import { APPOINTMENT_DETAIL_SELECT } from '@/integrations/mongodb/queries';
import type { Appointment, AppointmentStatus } from '@/integrations/mongodb/types';
import { SocketService } from '../services/core-api';

type QueueItem = Appointment & {
  patient?: { name?: string; full_name?: string };
};

export const useQueue = (doctorId?: string, date?: string) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchQueue = useCallback(async () => {
    if (!doctorId) {
      setQueue([]);
      return;
    }

    setIsLoading(true);
    try {
      let query = MongoDB
        .from('appointments')
        .select(APPOINTMENT_DETAIL_SELECT)
        .eq('doctor_id', doctorId)
        .in('status', ['confirmed', 'waiting', 'in_consultation'])
        .order('appointment_time', { ascending: true });

      if (date) query = query.eq('appointment_date', date);

      const { data, error } = await query;
      if (error) throw error;
      setQueue((data || []) as QueueItem[]);
    } catch (error) {
      console.error('[useQueue] Fetch failed:', error);
      setQueue([]);
    } finally {
      setIsLoading(false);
    }
  }, [date, doctorId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (!doctorId) return undefined;

    SocketService.connect();
    SocketService.emit('join.room', `doctor_${doctorId}`);

    const handleQueueUpdate = (updatedQueueItem: QueueItem) => {
      setQueue((prevQueue) =>
        prevQueue.map((item) => (item.id === updatedQueueItem.id ? updatedQueueItem : item)),
      );
    };

    SocketService.on('queue.item.updated', handleQueueUpdate);

    return () => {
      SocketService.off('queue.item.updated', handleQueueUpdate);
      SocketService.disconnect();
    };
  }, [doctorId]);

  const updateStatus = useCallback(
    async (appointmentId: string, status: AppointmentStatus) => {
      const { error } = await MongoDB.from('appointments').update({ status }).eq('id', appointmentId);
      if (error) return { success: false, error: error.message || 'Failed to update queue status' };
      await fetchQueue();
      return { success: true };
    },
    [fetchQueue],
  );

  const callNext = useCallback(async () => {
    const next = queue.find((item) => item.status === 'waiting') || queue.find((item) => item.status === 'confirmed');
    if (!next) return { success: false, error: 'No patients waiting' };
    return updateStatus(next.id, 'in_consultation');
  }, [queue, updateStatus]);

  return { queue, dailyQueue: queue, callNext, updateStatus, isLoading, refetch: fetchQueue };
};
