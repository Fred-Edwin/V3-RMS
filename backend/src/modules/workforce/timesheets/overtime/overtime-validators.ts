import { z } from 'zod';

export const overtimeParams = z.object({ id: z.string().uuid() }).strict();

export const overtimeListQuery = z
  .object({
    siteId: z.string().uuid().optional(),
    periodId: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'DECIDED', 'ALL']).default('PENDING'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(25),
  })
  .strict();
export type OvertimeListQuery = z.infer<typeof overtimeListQuery>;

const reason = z.string().trim().min(3, 'Say why').max(300);

/**
 * Approving authorises the time only; payroll decides pay. `minutes` lets a manager authorise less than was asked (never
 * more). Declining needs a reason.
 */
export const overtimeDecisionBody = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('APPROVE'), minutes: z.number().int().min(1).max(720).optional(), reason: reason.optional() }).strict(),
  z.object({ outcome: z.literal('DECLINE'), reason }).strict(),
]);
export type OvertimeDecisionBody = z.infer<typeof overtimeDecisionBody>;
