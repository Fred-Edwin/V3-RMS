import { z } from 'zod';
import { ClockTimeInstant, NairobiDay, reasonField } from './fixes-fields';

const common = { employeeId: z.string().uuid(), date: NairobiDay, rotaEntryId: z.string().uuid().optional(), reason: reasonField };

/** Edit a clock event's time, add a missing one, or take away one that should not be there. Always with a reason. */
export const fixSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('EDIT'), ...common, eventId: z.string().uuid(), at: ClockTimeInstant }).strict(),
  z.object({ action: z.literal('ADD'), ...common, type: z.enum(['IN', 'OUT']), at: ClockTimeInstant }).strict(),
  z.object({ action: z.literal('VOID'), ...common, eventId: z.string().uuid() }).strict(),
]);
export type FixInput = z.infer<typeof fixSchema>;

export const dayQuerySchema = z.object({ employeeId: z.string().uuid(), date: NairobiDay }).strict();
export type DayQuery = z.infer<typeof dayQuerySchema>;
