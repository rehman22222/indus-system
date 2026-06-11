import { useState } from 'react';
import { MongoDB } from '@/integrations/mongodb/client';

interface CreateStaffResult {
  success: boolean;
  error?: string;
  userId?: string;
}

export function useStaffCredentials() {
  const [isCreating, setIsCreating] = useState(false);

  const createStaffAccount = async (
    email: string,
    password: string,
    fullName: string,
    role: 'admin' | 'management' | 'doctor' | 'receptionist',
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
      // Step 1: Create auth user with MongoDB Auth
      const { data: authData, error: authError } = await MongoDB.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: additionalData?.phone || null,
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      const userId = authData.user.id;

      // Step 2: The profile should be created automatically by the trigger
      // But we need to add the role

      // Step 3: Add the staff role (we need to do this as admin)
      // Note: This will only work if current user is admin due to RLS
      const { error: roleError } = await MongoDB
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role,
        });

      if (roleError) {
        console.error('Role assignment error:', roleError);
        // The user was created but role assignment failed
        // This might be an RLS issue - the user still exists
      }

      // Step 4: If creating a doctor, also create a doctors record
      if (role === 'doctor' && additionalData) {
        const { error: doctorError } = await MongoDB
          .from('doctors')
          .insert({
            user_id: userId,
            name: fullName,
            specialty: additionalData.specialty || 'General Medicine',
            department_id: additionalData.departmentId || null,
            email: email,
            phone: additionalData.phone || null,
            daily_physical_quota: additionalData.dailyPhysicalQuota || 30,
            daily_video_quota: additionalData.dailyVideoQuota || 10,
            is_active: true,
          });

        if (doctorError) {
          console.error('Doctor record creation error:', doctorError);
        }
      }

      return { success: true, userId };
    } catch (error: any) {
      console.error('Staff creation error:', error);
      return { success: false, error: error.message };
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
