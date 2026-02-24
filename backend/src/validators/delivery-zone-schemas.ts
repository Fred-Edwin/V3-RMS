import { z } from 'zod';

const MAX_DELIVERY_FEE = 99_999_999.99;
const decimalFeePattern = /^\d{1,8}(\.\d{1,2})?$/;

const feeSchema = z
  .string()
  .regex(decimalFeePattern, 'fee must be a valid decimal amount')
  .refine((value) => Number.parseFloat(value) > 0, 'fee must be greater than 0')
  .refine(
    (value) => Number.parseFloat(value) <= MAX_DELIVERY_FEE,
    `fee must be less than or equal to ${MAX_DELIVERY_FEE}`,
  );

export const DeliveryZoneIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const CreateDeliveryZoneSchema = z.object({
  name: z.string().trim().min(1).max(100),
  fee: feeSchema,
});

export const UpdateDeliveryZoneSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    fee: feeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.fee !== undefined || data.isActive !== undefined, {
    message: 'At least one field is required',
  });

export type CreateDeliveryZoneInput = z.infer<typeof CreateDeliveryZoneSchema>;
export type UpdateDeliveryZoneInput = z.infer<typeof UpdateDeliveryZoneSchema>;
