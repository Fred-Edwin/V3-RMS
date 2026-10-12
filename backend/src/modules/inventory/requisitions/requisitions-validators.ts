import { z } from 'zod';
import {
  addAdditionInputSchema,
  approveAdditionInputSchema,
  approveInputSchema,
  cancelInputSchema,
  changeQuantityInputSchema,
  IDEMPOTENCY_HEADER,
  historyMineQuerySchema,
  idempotencyKeySchema,
  listRequisitionsQuerySchema,
  saveLinesInputSchema,
  sendSectionInputSchema,
  setUrgentInputSchema,
  skipSectionsInputSchema,
  startRequisitionInputSchema,
} from './_shared/requisitions-contract';

export {
  addAdditionInputSchema,
  approveAdditionInputSchema,
  approveInputSchema,
  cancelInputSchema,
  changeQuantityInputSchema,
  historyMineQuerySchema,
  listRequisitionsQuerySchema,
  saveLinesInputSchema,
  sendSectionInputSchema,
  setUrgentInputSchema,
  skipSectionsInputSchema,
  startRequisitionInputSchema,
};

export const requisitionParamsSchema = z.object({ id: z.string().uuid() });
export const sectionParamsSchema = z.object({ id: z.string().uuid(), departmentId: z.string().uuid() });
export const lineParamsSchema = z.object({ id: z.string().uuid(), lineId: z.string().uuid() });
export const additionParamsSchema = z.object({ id: z.string().uuid(), additionId: z.string().uuid() });

/** Signing writes carry their key in the `Idempotency-Key` header (R11 carries its own in the body). */
export const idempotencyHeaderSchema = z.object({ [IDEMPOTENCY_HEADER.toLowerCase()]: idempotencyKeySchema });
export const readIdempotencyKey = (headers: Record<string, unknown>): string => idempotencyHeaderSchema.parse(headers)[IDEMPOTENCY_HEADER.toLowerCase()] as string;
