import { ClockMethod, UserRole } from '@prisma/client';
import { z } from 'zod';
import { isoDateSchema, routeIdParamSchema } from './order-schemas';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be in HH:MM format');

export const CreateShiftSchema = z.object({
  name: z.string().trim().min(1).max(100),
  startTime: timeSchema,
  endTime: timeSchema,
});

export const UpdateShiftSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.startTime !== undefined || data.endTime !== undefined, {
    message: 'At least one field is required',
  });

export const ShiftListQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const ShiftAssignmentQuerySchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  userId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
});

export const CreateShiftAssignmentSchema = z.object({
  userId: z.string().uuid(),
  shiftId: z.string().uuid(),
  date: isoDateSchema,
});

export const BatchCreateShiftAssignmentSchema = z.object({
  shiftId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1).max(50),
  dates: z.array(isoDateSchema).min(1).max(62),
});

export const CopyWeekSchema = z.object({
  sourceWeekStart: isoDateSchema, // Monday of the source week (YYYY-MM-DD)
  targetWeekStart: isoDateSchema, // Monday of the target week (YYYY-MM-DD)
}).refine((d) => d.sourceWeekStart !== d.targetWeekStart, { message: 'sourceWeekStart and targetWeekStart must be different' });

export const BatchDeleteShiftAssignmentSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export const ClockInOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  shiftAssignmentId: z.string().uuid(),
});

export const ClockOverrideSchema = z.object({
  userId: z.string().uuid(),
  shiftAssignmentId: z.string().uuid(),
  action: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'VOID_CLOCK_OUT']),
  reason: z.string().trim().min(1).max(500),
});

export const UndoClockOutSchema = z.object({
  shiftAssignmentId: z.string().uuid(),
});

export const StaffAssignmentRoleSchema = z.enum([UserRole.WAITER, UserRole.CHEF, UserRole.BARISTA]);

export const ClockMethodSchema = z.nativeEnum(ClockMethod);

export const ShiftIdParamSchema = routeIdParamSchema;
export const ShiftAssignmentIdParamSchema = routeIdParamSchema;

export type CreateShiftInput = z.infer<typeof CreateShiftSchema>;
export type UpdateShiftInput = z.infer<typeof UpdateShiftSchema>;
export type ShiftListQueryInput = z.infer<typeof ShiftListQuerySchema>;
export type ShiftAssignmentQueryInput = z.infer<typeof ShiftAssignmentQuerySchema>;
export type CreateShiftAssignmentInput = z.infer<typeof CreateShiftAssignmentSchema>;
export type BatchCreateShiftAssignmentInput = z.infer<typeof BatchCreateShiftAssignmentSchema>;
export type CopyWeekInput = z.infer<typeof CopyWeekSchema>;
export type BatchDeleteShiftAssignmentInput = z.infer<typeof BatchDeleteShiftAssignmentSchema>;
export type ClockInOutInput = z.infer<typeof ClockInOutSchema>;
export type ClockOverrideInput = z.infer<typeof ClockOverrideSchema>;
export type UndoClockOutInput = z.infer<typeof UndoClockOutSchema>;
