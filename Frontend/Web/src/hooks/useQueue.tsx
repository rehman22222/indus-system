import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { APPOINTMENT_DETAIL_SELECT } from '@/integrations/supabase/queries';
import type { Appointment } from '@/integrations/supabase/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useQueue(doctorId: string | undefined, date: string) {
    const [queue, setQueue] = useState<Appointment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchQueue = useCallback(async () => {
        if (!doctorId) {
            setQueue([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fetchErr } = await supabase
                .from('appointments')
                .select(APPOINTMENT_DETAIL_SELECT)
                .eq('doctor_id', doctorId)
                .eq('appointment_date', date)
                .in('status', ['confirmed', 'waiting', 'in_consultation'])
                .order('check_in_time', { ascending: true, nullsFirst: false })
                .order('appointment_time', { ascending: true });

            if (fetchErr) throw fetchErr;
            setQueue((data ?? []) as unknown as Appointment[]);
        } catch (err) {
            console.error('[useQueue] Fetch failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch queue');
            setQueue([]);
        } finally {
            setIsLoading(false);
        }
    }, [doctorId, date]);

    useEffect(() => {
        if (!doctorId) return;

        fetchQueue();

        let channel: RealtimeChannel | null = null;

        try {
            channel = supabase
                .channel(`queue:${doctorId}:${date}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'appointments',
                        filter: `doctor_id=eq.${doctorId}`,
                    },
                    (payload) => {
                        console.log('[useQueue] Real-time update:', payload);
                        fetchQueue();
                    }
                )
                .subscribe();
        } catch (err) {
            console.warn('[useQueue] Real-time subscription failed:', err);
        }

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [doctorId, date, fetchQueue]);

    const callNext = useCallback(async () => {
        const nextPatient = queue.find((a) => a.status === 'waiting');
        if (!nextPatient) {
            return { success: false, error: 'No patients waiting' };
        }

        try {
            const { error: updateErr } = await supabase
                .from('appointments')
                .update({
                    status: 'in_consultation',
                    consultation_start_time: new Date().toISOString(),
                })
                .eq('id', nextPatient.id);

            if (updateErr) throw updateErr;
            await fetchQueue();
            return { success: true };
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to call next patient',
            };
        }
    }, [queue, fetchQueue]);

    const markComplete = useCallback(
        async (appointmentId: string) => {
            try {
                const { error: updateErr } = await supabase
                    .from('appointments')
                    .update({
                        status: 'completed',
                        consultation_end_time: new Date().toISOString(),
                    })
                    .eq('id', appointmentId);

                if (updateErr) throw updateErr;
                await fetchQueue();
                return { success: true };
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : 'Failed to mark complete',
                };
            }
        },
        [fetchQueue]
    );

    const updateStatus = useCallback(
        async (appointmentId: string, newStatus: Appointment['status']) => {
            try {
                const updates: Partial<Appointment> = { status: newStatus };

                if (newStatus === 'in_consultation') {
                    updates.consultation_start_time = new Date().toISOString();
                } else if (newStatus === 'completed') {
                    updates.consultation_end_time = new Date().toISOString();
                }

                const { error: updateErr } = await supabase
                    .from('appointments')
                    .update(updates)
                    .eq('id', appointmentId);

                if (updateErr) throw updateErr;
                await fetchQueue();
                return { success: true };
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : 'Failed to update status',
                };
            }
        },
        [fetchQueue]
    );

    return {
        queue,
        isLoading,
        error,
        refetch: fetchQueue,
        callNext,
        markComplete,
        updateStatus,
    };
}
