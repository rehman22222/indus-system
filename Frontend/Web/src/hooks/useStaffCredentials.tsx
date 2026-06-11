import { useState } from 'react';
import { MongoDB, isMongoReachable, isSchemaDeployed } from '@/integrations/mongodb/client';
import { authStore } from '@/auth/authStore';

interface CreateStaffResult {
  success: boolean;
  error?: string;
  userId?: string;
}

type LowerRole = 'admin' | 'management' | 'doctor' | 'receptionist';

const ROLE_MAP: Record<LowerRole, 'ADMIN' | 'MANAGEMENT' | 'DOCTOR' | 'RECEPTIONIST'> = {
  admin: 'ADMIN',
  management: 'MANAGEMENT',
  doctor: 'DOCTOR',
  receptionist: 'RECEPTIONIST',
};

export function useStaffCredentials() {
  const [isCreating, setIsCreating] = useState(false);

  const createStaffAccount = async (
    email: string,
    password: string,
    fullName: string,
    role: LowerRole,
    additionalData?: {
      phone?: string;
      specialty?: string;
      departmentId?: string;
      dailyPhysicalQuota?: number;
      dailyVideoQuota?: number;
    }
  ): Promise<CreateStaffResult> => {
    setIsCreating(true);

    try {
      // ---------------------------------------------------------
      // 1. Source of truth: the in-memory unified auth store.
      //    This is what the login page actually authenticates
      //    against, so registering here is what makes the new
      //    account real and usable — even with MongoDB offline
      //    or the schema not deployed. ALL four roles are
      //    registered (previously only doctor/management were,
      //    which is why admin/receptionist accounts silently
      //    failed while still showing a success toast).
      // ---------------------------------------------------------
      const mappedRole = ROLE_MAP[role];
      const stored = authStore.addStaffAccount(email, password, mappedRole, fullName);
      if ('error' in stored) {
        return { success: false, error: stored.error };
      }

      // ---------------------------------------------------------
      // 2. Persist a real doctor row to MongoDB so it shows in the
      //    admin list / booking. The login source of truth is the
      //    in-memory authStore, so the doctor row does NOT depend on
      //    MongoDB Auth — a best-effort signUp still runs to keep a
      //    matching auth user when email auth is available, but its
      //    failure never blocks the doctor record. (The previous
      //    code nested the insert inside a successful signUp and also
      //    wrote to a non-existent `user_roles` table, so the doctor
      //    was usually never stored.)
      // ---------------------------------------------------------
      if (role === 'doctor' && isMongoReachable() && isSchemaDeployed()) {
        let userId: string | null = null;
        try {
          const { data: authData } = await MongoDB.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, phone: additionalData?.phone || null } },
          });
          userId = authData?.user?.id ?? null;
        } catch {
          /* email auth unavailable in the demo — proceed without an auth user */
        }

        const { error: insertError } = await MongoDB.from('doctors').insert({
          user_id: userId,
          full_name: fullName,
          license_no: `PMC-${Date.now()}`,
          specialty: additionalData?.specialty || 'General Medicine',
          department_id: additionalData?.departmentId || null,
          email,
          phone: additionalData?.phone || null,
          daily_physical_quota: additionalData?.dailyPhysicalQuota || 30,
          daily_video_quota: additionalData?.dailyVideoQuota || 10,
          is_active: true,
        });

        if (insertError) {
          // Surface the real failure (e.g. RLS denial) instead of a
          // misleading success toast.
          return {
            success: false,
            error: `Login created, but the doctor record was not saved: ${insertError.message}`,
          };
        }
      } else if (role !== 'doctor' && isMongoReachable() && isSchemaDeployed()) {
        // Non-clinical staff: best-effort auth user only (no doctor row).
        try {
          await MongoDB.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName, phone: additionalData?.phone || null } },
          });
        } catch {
          /* ignore — the in-memory account is already usable */
        }
      }

      return { success: true };
    } finally {
      setIsCreating(false);
    }
  };

  const linkDoctorToUser = async (doctorId: string, userId: string) => {
    const { error } = await MongoDB
      .from('doctors')
      .update({ user_id: userId })
      .eq('id', doctorId);

    return { error };
  };

  return {
    createStaffAccount,
    linkDoctorToUser,
    isCreating,
  };
}
