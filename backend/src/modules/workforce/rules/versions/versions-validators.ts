import { z } from 'zod';

export const VersionParamsSchema = z.object({ id: z.string().uuid() });

const pin = z.string().regex(/^\d{4}$/, 'The PIN is 4 digits');
const reason = z.string().trim().min(1, 'Say why').max(500, 'Use 500 characters or fewer');

/** The change itself: shared by preview and create. Unknown keys are refused, so a typo is never silently dropped. */
export const ChangeBodySchema = z
  .object({
    siteId: z.string().uuid().nullable().default(null),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    values: z.record(z.string(), z.unknown()).default({}),
    useCompanyRuleFor: z.array(z.string().min(1).max(60)).max(20).optional(),
    expectedVersion: z.number().int().min(0).optional(),
  })
  .strict();

export const CreateBodySchema = ChangeBodySchema.extend({
  reason,
  pin,
  idempotencyKey: z.string().min(8).max(100).optional(),
}).strict();

export const WithdrawBodySchema = z.object({ reason, pin }).strict();

export type ChangeBody = z.infer<typeof ChangeBodySchema>;
export type CreateBody = z.infer<typeof CreateBodySchema>;
export type WithdrawBody = z.infer<typeof WithdrawBodySchema>;
