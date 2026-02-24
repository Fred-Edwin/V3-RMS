import { apiClient } from '@/lib/apiClient';
import type { AuthUser } from '@/types/auth';

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export const authService = {
  login: (input: LoginInput): Promise<{ accessToken: string; user: AuthUser }> => {
    return apiClient.post('/auth/login', input);
  },

  logout: async (accessToken: string): Promise<void> => {
    await apiClient.post('/auth/logout', {}, accessToken);
  },

  refreshToken: (): Promise<{ accessToken: string; user: AuthUser }> => {
    return apiClient.post('/auth/refresh', {});
  },

  changePassword: async (input: ChangePasswordInput, accessToken: string): Promise<void> => {
    await apiClient.patch('/auth/change-password', input, accessToken);
  },

  registerDevice: async (input: { fcmToken: string }, accessToken: string): Promise<void> => {
    await apiClient.post('/auth/register-device', input, accessToken);
  },
};
