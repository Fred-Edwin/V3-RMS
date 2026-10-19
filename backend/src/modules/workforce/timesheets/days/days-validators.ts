import { z } from 'zod';

const reason = z.string().trim().min(3, 'Say why').max(300);

export const periodPersonParams = z.object({ id: z.string().uuid(), employeeId: z.string().uuid() }).strict();
export const dayParams = z.object({ id: z.string().uuid() }).strict();

/**
 * Accept the day as recorded, excuse the lateness, or hold it back. Excusing and holding need a reason; accepting
 * needs none. "Adjust" is the attendance fix (it records a correction); this endpoint never edits a clock time.
 */
export const decisionBody = z
  .discriminatedUnion('outcome', [
    z.object({ outcome: z.literal('ACCEPT'), reason: reason.optional() }).strict(),
    z.object({ outcome: z.literal('EXCUSE'), reason }).strict(),
    z.object({ outcome: z.literal('HOLD'), reason }).strict(),
  ]);
export type DecisionBody = z.infer<typeof decisionBody>;
