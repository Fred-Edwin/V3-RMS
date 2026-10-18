import { z } from 'zod';
import { idField, nairobiDateField } from '../rota-fields';

export const WeekQuerySchema = z.object({
  siteId: idField.optional(),
  weekStart: nairobiDateField,
  departmentId: idField.optional(),
});

export const MyShiftsQuerySchema = z
  .object({ from: nairobiDateField.optional(), to: nairobiDateField.optional() })
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'From is after to');

export type WeekQuery = z.infer<typeof WeekQuerySchema>;
export type MyShiftsQuery = z.infer<typeof MyShiftsQuerySchema>;
