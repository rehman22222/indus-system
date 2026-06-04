import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateDepartmentInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface CreateDepartmentResult {
  data: Department | null;
  error: Error | null;
}

const SELECT_COLS = 'id, name, description, icon, color, is_active, created_at';

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select(SELECT_COLS)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      // Live Supabase rows only. No static fallback — empty table
      // means an empty list.
      setDepartments((data || []) as Department[]);
    } catch (err) {
      setError(err as Error);
      setDepartments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Admin-only: create a new department. The new row is refetched into the
  // shared list so every department dropdown updates immediately.
  const createDepartment = useCallback(
    async (input: CreateDepartmentInput): Promise<CreateDepartmentResult> => {
      const name = input.name.trim();
      if (!name) {
        return { data: null, error: new Error('Department name is required.') };
      }

      // Guard against duplicates (case-insensitive) before hitting the DB.
      if (departments.some((d) => d.name.trim().toLowerCase() === name.toLowerCase())) {
        return { data: null, error: new Error('A department with this name already exists.') };
      }

      const { data, error } = await supabase
        .from('departments')
        .insert({
          name,
          description: input.description?.trim() || null,
          icon: input.icon?.trim() || 'Stethoscope',
          color: input.color?.trim() || '#0ea5e9',
          is_active: true,
        })
        .select(SELECT_COLS)
        .single();

      if (error) {
        return { data: null, error: error as unknown as Error };
      }

      await fetchDepartments();
      return { data: data as Department, error: null };
    },
    [departments, fetchDepartments],
  );

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  return { departments, isLoading, error, refetch: fetchDepartments, createDepartment };
}
