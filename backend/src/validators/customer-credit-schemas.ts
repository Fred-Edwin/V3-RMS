import { z } from 'zod';
import { moneySchema } from './house-account-schemas';

export const CustomerCreditIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const CreateCustomerCreditSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(200),
  customerPhone: z.string().trim().min(10, 'Phone number is too short').max(15, 'Phone number is too long'),
  creditLimit: moneySchema,
  notes: z.string().max(500).optional(),
});

export const UpdateCustomerCreditSchema = z
  .object({
    customerName: z.string().trim().min(1).max(200).optional(),
    customerPhone: z.string().trim().min(10).max(15).optional(),
    creditLimit: moneySchema.optional(),
    notes: z.string().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.customerName !== undefined ||
      data.customerPhone !== undefined ||
      data.creditLimit !== undefined ||
      data.notes !== undefined ||
      data.isActive !== undefined,
    { message: 'At least one field must be provided' },
  );

export const RecordCustomerCreditSettlementSchema = z.object({
  amount: moneySchema,
  note: z.string().max(500).optional(),
});

export type CreateCustomerCreditInput = z.infer<typeof CreateCustomerCreditSchema>;
export type UpdateCustomerCreditInput = z.infer<typeof UpdateCustomerCreditSchema>;
export type RecordCustomerCreditSettlementInput = z.infer<typeof RecordCustomerCreditSettlementSchema>;
