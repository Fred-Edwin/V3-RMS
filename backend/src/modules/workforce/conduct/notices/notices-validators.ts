import { z } from 'zod';
import { APPEAL_REASON_KEYS, APPEAL_TEXT_MAX, APPEAL_TEXT_MIN, DECISION_REASON_MAX, DECISION_REASON_MIN, OWN_LINE_MAX, OWN_LINE_MIN } from '../_shared/conduct-model';
import { plainText } from '../letters/letter-text';

const id = z.string().uuid();
const idempotencyKey = z.string().min(8).max(100);
const pin = z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits');
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
/** Plain text, flattened (control characters and line breaks become spaces) and measured after trimming. */
const text = (min: number, max: number) =>
  z.string().transform(plainText).pipe(z.string().min(min, `At least ${min} characters`).max(max, `At most ${max} characters`));

export const levelSchema = z.enum(['VERBAL_NOTE', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING']);
export const aboutSchema = z.enum(['LATENESS', 'ABSENCE', 'BEHAVIOUR', 'SAFETY_HYGIENE', 'OTHER']);

export const idParams = z.object({ id });

export const issueBody = z
  .object({ personId: id, level: levelSchema, about: aboutSchema, factsMonth: monthKey.optional(), ownLine: text(OWN_LINE_MIN, OWN_LINE_MAX), pin, idempotencyKey })
  .strict();
export type IssueBody = z.infer<typeof issueBody>;

export const draftQuery = z.object({ personId: id, about: aboutSchema, month: monthKey.optional() }).strict();
export type DraftQuery = z.infer<typeof draftQuery>;

/** The draft preview takes the issue body without a PIN. */
export const previewBody = z.object({ personId: id, level: levelSchema, about: aboutSchema, factsMonth: monthKey.optional(), ownLine: text(OWN_LINE_MIN, OWN_LINE_MAX) }).strict();
export type PreviewBody = z.infer<typeof previewBody>;

export const peopleQuery = z.object({ q: z.string().trim().max(60).default(''), purpose: z.enum(['issue']).default('issue') }).strict();

export const witnessQuery = z.object({ q: z.string().trim().max(60).default(''), noticeId: id }).strict();

export const signBody = z.object({ code: pin, deviceId: z.string().min(1).max(100), idempotencyKey }).strict();
export type SignBody = z.infer<typeof signBody>;

export const notSignedBody = z.object({ reason: z.enum(['REFUSED', 'NOT_REACHED', 'NO_LOGIN']), witnessId: id, pin, idempotencyKey }).strict();
export type NotSignedBody = z.infer<typeof notSignedBody>;

export const witnessBody = z.object({ confirmed: z.boolean(), code: pin.optional() }).strict().refine((b) => !b.confirmed || b.code !== undefined, { message: 'Enter your code to confirm', path: ['code'] });
export type WitnessBody = z.infer<typeof witnessBody>;

export const appealBody = z.object({ reasonKey: z.enum(APPEAL_REASON_KEYS), text: text(APPEAL_TEXT_MIN, APPEAL_TEXT_MAX), idempotencyKey }).strict();
export type AppealBody = z.infer<typeof appealBody>;

export const decisionBody = z
  .object({ outcome: z.enum(['KEEP', 'REDUCE_TO_WRITTEN', 'REDUCE_TO_VERBAL', 'WITHDRAW']), reason: text(DECISION_REASON_MIN, DECISION_REASON_MAX), pin, idempotencyKey })
  .strict();
export type DecisionBody = z.infer<typeof decisionBody>;

export const decisionPreviewBody = z.object({ outcome: z.enum(['KEEP', 'REDUCE_TO_WRITTEN', 'REDUCE_TO_VERBAL', 'WITHDRAW']) }).strict();

export const listQuery = z
  .object({
    status: z.enum(['active', 'appealed', 'ended']).default('active'),
    site: id.optional(),
    q: z.string().trim().max(60).default(''),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n), 'Rows per page: 25, 50 or 100').default(25),
  })
  .strict();
export type ListQuery = z.infer<typeof listQuery>;

export const documentQuery = z.object({ version: z.enum(['1', '2', '3', 'latest']).default('latest'), inline: z.enum(['0', '1']).default('0') }).strict();
