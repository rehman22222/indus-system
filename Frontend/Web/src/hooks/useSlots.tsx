import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AvailableSlot {
  id: string;
  slot_time: string;
  is_available: boolean;
}

export function useAvailableSlots() {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSlots = useCallback(async (doctorId: string, date: string) => {
    if (!doctorId || !date) {
      setSlots([]);
      return;
    }

    setIsLoading(true);
    try {
      // First try to generate slots if none exist
      await supabase.rpc('generate_daily_slots', {
        p_doctor_id: doctorId,
        p_date: date,
      });

      // Fetch free slots from appointment_slots table
      const { data, error } = await supabase
        .from('appointment_slots')
        .select('id, slot_time, is_available')
        .eq('doctor_id', doctorId)
        .eq('slot_date', date)
        .eq('is_available', true)
        .order('slot_time');

      if (error) throw error;
      
      // Transform to AvailableSlot interface
      const formattedSlots: AvailableSlot[] = (data || []).map(s => ({
        id: s.id,
        slot_time: s.slot_time.substring(0, 5), // HH:MM
        is_available: s.is_available
      }));

      setSlots(formattedSlots);
    } catch (err) {
      console.error('[useAvailableSlots] Fetch failed:', err);
      setSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { slots, isLoading, fetchSlots };
}
