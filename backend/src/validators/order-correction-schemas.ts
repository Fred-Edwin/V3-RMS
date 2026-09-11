import { PaymentMethod } from '@prisma/client';
import { z } from 'zod';

export const correctionIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const correctionItemParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
  itemId: z.string().uuid('itemId param must be a valid UUID'),
});

export const correctionTicketParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
  ticketId: z.string().uuid('ticketId param must be a valid UUID'),
});

export const correctionSplitLineParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
  lineId: z.string().uuid('lineId param must be a valid UUID'),
});

const reasonSchema = z
  .string()
  .min(10, 'Reason must be at least 10 characters')
  .max(1000, 'Reason must be at most 1000 characters');

export const CorrectMpesaCodeSchema = z.object({
  mpesaCode: z
    .string()
    .min(1, 'M-Pesa code is required')
    .max(20, 'M-Pesa code must be at most 20 characters')
    .regex(/^[A-Z0-9]+$/i, 'M-Pesa code must be alphanumeric'),
  reason: reasonSchema,
});

export const CorrectPaymentMethodSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod),
  reason: reasonSchema,
});

export const ForceOrderReadySchema = z.object({
  reason: reasonSchema,
});

export const RevertAwaitingAuthSchema = z.object({
  reason: reasonSchema,
});

export const RemoveOrderItemSchema = z.object({
  reason: reasonSchema,
});

export const RevertRejectedTicketSchema = z.object({
  reason: reasonSchema,
});

export const AdjustOrderTotalSchema = z.object({
  newTotal: z
    .number({ message: 'newTotal must be a number' })
    .nonnegative('newTotal must be zero or positive'),
  reason: reasonSchema,
});

export const RemoveSplitLineSchema = z.object({
  reason: reasonSchema,
});

export const AddSplitLineCorrectionSchema = z
  .object({
    label: z.string().min(1).max(100),
    amount: z.number().positive(),
    method: z.enum(['MPESA', 'CASH', 'CARD'] as const),
    mpesaCode: z.string().min(1).max(200).optional(),
    reason: reasonSchema,
  })
  .superRefine((data, ctx) => {
    if (data.method === 'MPESA' && !data.mpesaCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mpesaCode is required for Mpesa payment',
        path: ['mpesaCode'],
      });
    }
  });

const splitLineDraftSchema = z
  .object({
    label: z.string().min(1).max(100),
    amount: z.number().positive(),
    method: z.enum(['MPESA', 'CASH', 'CARD'] as const),
    mpesaCode: z.string().min(1).max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'MPESA' && !data.mpesaCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mpesaCode is required for Mpesa payment',
        path: ['mpesaCode'],
      });
    }
  });

export const ConvertToSplitSchema = z.object({
  lines: z.array(splitLineDraftSchema).min(2, 'A split payment needs at least 2 lines'),
  reason: reasonSchema,
});

export const ListOrderCorrectionsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  status: z.string().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListOrderCorrectionsQuery = z.infer<typeof ListOrderCorrectionsQuerySchema>;
export type CorrectMpesaCodeInput = z.infer<typeof CorrectMpesaCodeSchema>;
export type CorrectPaymentMethodInput = z.infer<typeof CorrectPaymentMethodSchema>;
export type ForceOrderReadyInput = z.infer<typeof ForceOrderReadySchema>;
export type RevertAwaitingAuthInput = z.infer<typeof RevertAwaitingAuthSchema>;
export type RemoveOrderItemInput = z.infer<typeof RemoveOrderItemSchema>;
export type RevertRejectedTicketInput = z.infer<typeof RevertRejectedTicketSchema>;
export type AdjustOrderTotalInput = z.infer<typeof AdjustOrderTotalSchema>;
export type RemoveSplitLineInput = z.infer<typeof RemoveSplitLineSchema>;
export type AddSplitLineCorrectionInput = z.infer<typeof AddSplitLineCorrectionSchema>;
export type ConvertToSplitInput = z.infer<typeof ConvertToSplitSchema>;
