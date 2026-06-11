import { apiRequest } from '@/api/client';
import type { AuthSession } from '@/api/types';

export async function login(email: string, password: string) {
  const result = await apiRequest<AuthSession & { success: boolean }>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  return {
    token: result.token,
    user: result.user,
  };
}
