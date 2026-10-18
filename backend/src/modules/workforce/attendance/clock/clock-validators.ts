import { z } from 'zod';
import { REASON_MAX_LENGTH, STAY_ON_REASONS } from '../attendance.constants';

const instant = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

/** The idempotency key the phone makes once per tap and keeps for every retry. */
const clientEventId = z.string().trim().min(8).max(64);

const tap = {
  clientEventId,
  rotaEntryId: z.string().uuid().optional(),
  /** When the person tapped, by the phone's clock; and what that clock said when the request was sent. */
  deviceAt: instant.optional(),
  sentAt: instant.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
};

const withPosition = <T extends { latitude?: number | undefined; longitude?: number | undefined }>(value: T): boolean => (value.latitude === undefined) === (value.longitude === undefined);
const positionMessage = { message: 'Send both latitude and longitude, or neither', path: ['latitude'] };

export const clockInSchema = z.object(tap).strict().refine(withPosition, positionMessage);

export const clockOutSchema = z
  .object({ ...tap, reasonCode: z.string().trim().max(40).optional(), reason: z.string().trim().max(REASON_MAX_LENGTH).optional() })
  .strict()
  .refine(withPosition, positionMessage);

export const undoSchema = z.object({ clientEventId }).strict();

export const shiftEndSchema = z
  .object({
    rotaEntryId: z.string().uuid(),
    answer: z.literal('STAY_ON'),
    reasonCode: z.enum(STAY_ON_REASONS),
    estimateMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(), // STAY_ON_ESTIMATES
  })
  .strict();

export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type UndoInput = z.infer<typeof undoSchema>;
export type ShiftEndInput = z.infer<typeof shiftEndSchema>;
