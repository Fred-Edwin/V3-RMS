import { z } from 'zod';
import { parseNairobiDate, type NairobiDate } from '../../_shared/time/nairobi-time';
import { REASON_MAX_LENGTH } from '../attendance.constants';

/** A calendar day, "2026-10-12", as the Nairobi date the whole module counts in. */
export const NairobiDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .transform((value, ctx): NairobiDate => {
    try {
      return parseNairobiDate(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Not a real date' });
      return z.NEVER;
    }
  });

/** An instant with an offset ("2026-10-12T06:05:00+03:00" or "...Z"), as a Date. */
export const ClockTimeInstant = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

/** A fix, a clock for someone else, and a cleared time all need a reason (proposal 5.4); a few words at least. */
export const reasonField = z.string().trim().min(3, 'Say why').max(REASON_MAX_LENGTH);
