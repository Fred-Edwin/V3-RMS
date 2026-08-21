import { z } from 'zod';

const decimalString = z.union([z.string(), z.number()]);

export const dispatchIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const requisitionIdParamSchema = z.object({
  requisitionId: z.string().uuid('requisitionId param must be a valid UUID'),
});

export const fulfilRequisitionSchema = z.object({
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        dispatchedQty: decimalString,
      }),
    )
    .min(1, 'A dispatch must have at least one line'),
});

export const rejectFulfilmentSchema = z.object({
  reason: z.string().min(1, 'A rejection reason is required'),
});

export const unsolicitedDispatchSchema = z.object({
  toLocationId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        dispatchedQty: decimalString,
      }),
    )
    .min(1, 'A dispatch must have at least one line'),
});

export const receiveDispatchSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        receivedQty: decimalString,
      }),
    )
    .min(1, 'At least one line must be confirmed'),
});

export const listDispatchesQuerySchema = z.object({
  status: z.enum(['PICKING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED']).optional(),
});
