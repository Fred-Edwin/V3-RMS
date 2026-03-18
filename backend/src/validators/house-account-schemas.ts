import { z } from 'zod';

export const moneySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Amount must be a valid decimal (e.g. 1500 or 1500.00)')
  .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0')
  .refine((v) => parseFloat(v) <= 99_999_999.99, 'Amount must be less than or equal to 99,999,999.99');

export const HouseAccountIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const CreateHouseAccountSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  creditLimit: moneySchema.nullable().optional(),
});

export const UpdateHouseAccountSchema = z
  .object({
    creditLimit: moneySchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.creditLimit !== undefined || data.isActive !== undefined, {
    message: 'At least one field must be provided',
  });

export const RecordHouseSettlementSchema = z.object({
  amount: moneySchema,
  note: z.string().max(500).optional(),
});

export type CreateHouseAccountInput = z.infer<typeof CreateHouseAccountSchema>;
export type UpdateHouseAccountInput = z.infer<typeof UpdateHouseAccountSchema>;
export type RecordHouseSettlementInput = z.infer<typeof RecordHouseSettlementSchema>;
