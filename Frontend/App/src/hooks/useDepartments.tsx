import { useState, useEffect } from 'react';
import { MongoDB } from '@/integrations/mongodb/client';
import { DEPARTMENT_LIST_SELECT } from '@/integrations/mongodb/queries';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchErr } = await MongoDB
          .from('departments')
          .select(DEPARTMENT_LIST_SELECT)
          .eq('is_active', true)
          .order('name');

        if (fetchErr) throw fetchErr;
        setDepartments(data || []);
      } catch (err) {
        console.error('[useDepartments] Fetch failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch departments');
        setDepartments([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  return { departments, isLoading, error };
}
