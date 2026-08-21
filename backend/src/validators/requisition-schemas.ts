import { z } from 'zod';

const decimalString = z.union([z.string(), z.number()]);

export const requisitionIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const raiseRequisitionSchema = z.object({
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid(),
        requestedQty: decimalString,
        notes: z.string().optional(),
      }),
    )
    .min(1, 'A requisition must have at least one line'),
});

export const approveRequisitionSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        approvedQty: decimalString,
      }),
    )
    .default([]),
});

export const rejectRequisitionSchema = z.object({
  reason: z.string().min(1, 'A rejection reason is required'),
});

export const listRequisitionsQuerySchema = z.object({
  status: z
    .enum([
      'DRAFT',
      'PENDING_MANAGER_APPROVAL',
      'APPROVED',
      'REJECTED',
      'PENDING_FULFILMENT',
      'PARTIALLY_FULFILLED',
      'FULFILLED',
      'CANCELLED',
    ])
    .optional(),
});
