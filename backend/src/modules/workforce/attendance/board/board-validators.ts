import { z } from 'zod';
import { ClockTimeInstant, NairobiDay, reasonField } from '../fixes/fixes-fields';

export const boardQuerySchema = z.object({ siteId: z.string().uuid().optional(), date: NairobiDay.optional() }).strict();
export type BoardQuery = z.infer<typeof boardQuerySchema>;

/** "Clock in for her": the arrival time and a reason, both required. */
export const clockForSchema = z
  .object({
    employeeId: z.string().uuid(),
    type: z.enum(['IN', 'OUT']),
    at: ClockTimeInstant,
    reason: reasonField,
    rotaEntryId: z.string().uuid().optional(),
  })
  .strict();
export type ClockForInput = z.infer<typeof clockForSchema>;
