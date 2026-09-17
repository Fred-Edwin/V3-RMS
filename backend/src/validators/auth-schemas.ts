import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const registerDeviceSchema = z.object({
  fcmToken: z.string().min(1),
});

export const verifyPasswordSchema = z.object({
  password: z.string().min(1),
});

/** 4-digit numeric PIN, matching the Sign Sheet's OTP input (frontend/features/inventory/components/sign-sheet.tsx). */
export const setPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'must be a 4-digit code'),
});
