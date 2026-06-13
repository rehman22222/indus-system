import { useState } from 'react';
import { MongoDB, apiRequest } from '@/integrations/mongodb/client';

interface CreateStaffResult {
  success: boolean;
  error?: string;
  userId?: string;
}

type LowerRole = 'admin' | 'management' | 'doctor' | 'receptionist';

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
    },
  ): Promise<CreateStaffResult> => {
    setIsCreating(true);
    try {
      const response = await apiRequest<{ data?: { userId?: string } }>('/api/v1/admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name: fullName,
          role,
          phone: additionalData?.phone,
          specialty: additionalData?.specialty,
          departmentId: additionalData?.departmentId,
          dailyPhysicalQuota: additionalData?.dailyPhysicalQuota,
          dailyVideoQuota: additionalData?.dailyVideoQuota,
        }),
      });
      return { success: true, userId: response.data?.userId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not create staff account',
      };
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

  return { createStaffAccount, linkDoctorToUser, isCreating };
}
