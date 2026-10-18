import { z } from 'zod';
import { NairobiDay } from '../fixes/fixes-fields';

export const MAX_LATENESS_DAYS = 62;

export const latenessQuerySchema = z
  .object({
    siteId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    from: NairobiDay,
    to: NairobiDay,
    /** By default only the days that count as late; true lists every clocked shift. */
    includeOnTime: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();
export type LatenessQuery = z.infer<typeof latenessQuerySchema>;
