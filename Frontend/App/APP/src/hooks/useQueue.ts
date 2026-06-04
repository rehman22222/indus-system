import { useState, useEffect } from 'react';
import { SocketService } from '@acme/core-api';

export const useQueue = (doctorId) => {
  const [dailyQueue, setDailyQueue] = useState([]);

  useEffect(() => {
    SocketService.connect();
    SocketService.emit('join.room', `doctor_${doctorId}`);

    const handleQueueUpdate = (updatedQueueItem) => {
      setDailyQueue(prevQueue =>
        prevQueue.map(item => (item.id === updatedQueueItem.id ? updatedQueueItem : item))
      );
    };

    SocketService.on('queue.item.updated', handleQueueUpdate);

    return () => {
      SocketService.off('queue.item.updated', handleQueueUpdate);
      SocketService.disconnect();
    };
  }, [doctorId]);

  return { dailyQueue };
};
