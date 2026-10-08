import type { CountCause } from '@prisma/client';
import { CAUSE_TEXT } from './counting-contract';

/** The reason written on a count adjustment: the cause words, with the note after them for "Other". */
export const adjustmentReason = (cause: CountCause, note: string | null): string => (note ? `${CAUSE_TEXT[cause]}: ${note}` : CAUSE_TEXT[cause]);

/** The reason on an adjustment for a within-range line the Manager accepted. */
export const ACCEPTED_REASON = 'Within range · accepted';
