import { z } from 'zod';

const decimalString = z.union([z.string(), z.number()]);

export const marketPurchaseOrderIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const listMarketPurchaseOrdersQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'APPROVED', 'SENT_TO_MARKET', 'RECONCILING', 'COMPLETED', 'RECEIVED', 'REJECTED'])
    .optional(),
});

export const requestMarketItemsSchema = z.object({
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        requestedQty: decimalString,
        notes: z.string().optional(),
      }),
    )
    .min(1, 'A request must have at least one line'),
});

export const editDraftLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        requestedQty: decimalString,
      }),
    )
    .min(1, 'At least one line must be edited'),
});

export const removeDraftLineParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
  lineId: z.string().uuid('lineId param must be a valid UUID'),
});

export const reconcileLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        actualQty: decimalString,
        unitPrice: decimalString,
      }),
    )
    .min(1, 'At least one line must be reconciled'),
});

export const rejectMarketPurchaseOrderSchema = z.object({
  reason: z.string().min(1, 'A rejection reason is required'),
});
