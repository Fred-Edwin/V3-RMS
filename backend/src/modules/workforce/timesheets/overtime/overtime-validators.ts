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

/** Approving part moves in steps of 5 minutes (D3); a reason is required for part or none (D4, at least 5 characters). */
export const PART_STEP_MINUTES = 5;
const reason = z.string().trim().max(280);

/**
 * Approve all, part or none, with the manager's own PIN and the version the screen showed (D25). Approving authorises the time
 * only; payroll decides pay. `approvedMinutes` is what is authorised out of what needed a decision.
 */
export const overtimeDecisionBody = z
  .object({
    decision: z.enum(['APPROVE_ALL', 'APPROVE_PART', 'DECLINE']),
    approvedMinutes: z.number().int().min(PART_STEP_MINUTES).max(720).optional(),
    reason: reason.optional(),
    pin: z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits'),
    version: z.number().int().min(0),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.decision === 'APPROVE_PART' && body.approvedMinutes === undefined) ctx.addIssue({ code: 'custom', path: ['approvedMinutes'], message: 'Say how much to approve' });
    if (body.decision !== 'APPROVE_PART' && body.approvedMinutes !== undefined) ctx.addIssue({ code: 'custom', path: ['approvedMinutes'], message: 'Minutes are only for approving part' });
    if (body.decision !== 'APPROVE_ALL' && (body.reason ?? '').length < 5) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Say why. This is needed to approve part or decline.' });
  });
export type OvertimeDecisionBody = z.infer<typeof overtimeDecisionBody>;

/** A department head's one-line note (D24): 140 characters, once, while the item is pending. */
export const overtimeNoteBody = z.object({ text: z.string().trim().min(2).max(140) }).strict();
export type OvertimeNoteBody = z.infer<typeof overtimeNoteBody>;
