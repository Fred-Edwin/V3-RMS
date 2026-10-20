import { z } from 'zod';
import { idempotencyKey, reason } from '../recording/recording-validators';

const version = z.number().int().min(0);
const pin = z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits');
const money = z.string().regex(/^\d{1,9}(\.\d{1,2})?$/, 'Use digits with up to 2 decimals');

export const approveBody = z.object({ pin, version, idempotencyKey, expectedTotal: money }).strict();
export type ApproveBody = z.infer<typeof approveBody>;

export const sendBackBody = z.object({ reason, version, idempotencyKey }).strict();
export const voidBody = z.object({ reason, pin, version, idempotencyKey }).strict();

/** The worker types their full name on the head's phone (PD25). */
export const receiveBody = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Type your full name')
      .max(80)
      .refine((v) => v.split(/\s+/).length >= 2, 'Type your full name'),
    idempotencyKey,
  })
  .strict();
export type ReceiveBody = z.infer<typeof receiveBody>;

export const receiveParams = z.object({ id: z.string().uuid(), lineId: z.string().uuid() }).strict();
