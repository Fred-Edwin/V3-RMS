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

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout', {});
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

  // Stateless re-authentication for view-gates (e.g. payslip page).
  // Resolves on match; throws ApiError (401) on mismatch.
  verifyPassword: async (password: string, accessToken: string): Promise<void> => {
    await apiClient.post('/auth/verify-password', { password }, accessToken);
  },

  /** Whether the caller has set a signing PIN. Boolean only — the hash never leaves the server. */
  getPinStatus: (accessToken: string): Promise<{ hasPin: boolean }> => {
    return apiClient.get('/users/me/pin-status', accessToken);
  },

  /** Sets (first time) or changes the caller's signing PIN. `currentPassword` is required only when a PIN already exists. */
  setPin: async (input: { pin: string; currentPassword?: string }, accessToken: string): Promise<void> => {
    await apiClient.post('/users/me/pin', input, accessToken);
  },
};
