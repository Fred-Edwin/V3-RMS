import { UserRole } from '@prisma/client';
import { z } from 'zod';

export const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole),
  temporaryPassword: z.string().min(8),
  organizationId: z.string().uuid().optional(),
});

export const updateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
});

export const listStaffQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      return value === 'true';
    }),
});
