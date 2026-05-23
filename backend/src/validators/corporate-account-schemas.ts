import { z } from 'zod';
import { moneySchema } from './house-account-schemas';

export const CorporateAccountIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const CreateCorporateAccountSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(200),
  contactName: z.string().trim().min(1, 'Contact name is required').max(200),
  contactPhone: z.string().trim().min(1, 'Contact phone is required').max(30),
  contactEmail: z.string().email('Invalid email address').optional(),
  creditLimit: moneySchema.nullable().optional(),
  billingCycleDay: z.number().int().min(1).max(28).default(1),
});

export const UpdateCorporateAccountSchema = z
  .object({
    companyName: z.string().trim().min(1).max(200).optional(),
    contactName: z.string().trim().min(1).max(200).optional(),
    contactPhone: z.string().trim().min(1).max(30).optional(),
    contactEmail: z.string().email().nullable().optional(),
    creditLimit: moneySchema.nullable().optional(),
    billingCycleDay: z.number().int().min(1).max(28).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.companyName !== undefined ||
      data.contactName !== undefined ||
      data.contactPhone !== undefined ||
      data.contactEmail !== undefined ||
      data.creditLimit !== undefined ||
      data.billingCycleDay !== undefined ||
      data.isActive !== undefined,
    { message: 'At least one field must be provided' },
  );

export const RecordCorporateSettlementSchema = z.object({
  amount: moneySchema,
  paymentMethod: z.enum(['MPESA', 'CASH', 'CARD']),
  note: z.string().max(500).optional(),
});

export type CreateCorporateAccountInput = z.infer<typeof CreateCorporateAccountSchema>;
export type UpdateCorporateAccountInput = z.infer<typeof UpdateCorporateAccountSchema>;
export type RecordCorporateSettlementInput = z.infer<typeof RecordCorporateSettlementSchema>;
