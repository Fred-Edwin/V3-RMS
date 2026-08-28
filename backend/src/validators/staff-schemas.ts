import { UserRole, DepartmentTag } from '@prisma/client';
import { z } from 'zod';

export const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole),
  temporaryPassword: z.string().min(8),
  organizationId: z.string().uuid().optional(),
  departmentTag: z.nativeEnum(DepartmentTag).nullable().optional(),
});

export const updateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  departmentTag: z.nativeEnum(DepartmentTag).nullable().optional(),
});

export const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8),
});

export const listStaffQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  role: z.nativeEnum(UserRole).optional(),
  onShift: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      return value === 'true';
    }),
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

export const staffIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});
