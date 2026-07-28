import { z } from 'zod';

/** Positive decimal quantity/factor — up to 12,4 precision, matching the Prisma column type. */
export const quantitySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,4})?$/, 'Must be a valid decimal (e.g. 12 or 12.5)')
  .refine((v) => parseFloat(v) > 0, 'Must be greater than 0');

/** Same as quantitySchema but allows 0 (e.g. a reorder level of 0 is valid). */
export const nonNegativeQuantitySchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,4})?$/, 'Must be a valid decimal (e.g. 12 or 12.5)')
  .refine((v) => parseFloat(v) >= 0, 'Must be zero or greater');

export const InventoryIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

const departmentTagEnum = z.enum(['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING']);
const inventoryItemTypeEnum = z.enum(['RAW', 'PREPPED', 'PASS_THROUGH']);

export const CreateInventoryItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: inventoryItemTypeEnum,
  buyUnit: z.string().trim().min(1, 'Buy unit is required').max(20),
  usageUnit: z.string().trim().min(1, 'Usage unit is required').max(20),
  conversionFactor: quantitySchema,
  reorderLevel: nonNegativeQuantitySchema,
  departmentTags: z.array(departmentTagEnum).default([]),
  defaultSupplierId: z.string().uuid().optional(),
});

export const UpdateInventoryItemSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    type: inventoryItemTypeEnum.optional(),
    buyUnit: z.string().trim().min(1).max(20).optional(),
    usageUnit: z.string().trim().min(1).max(20).optional(),
    conversionFactor: quantitySchema.optional(),
    reorderLevel: nonNegativeQuantitySchema.optional(),
    departmentTags: z.array(departmentTagEnum).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided' },
  );

export const LowStockQuerySchema = z.object({
  locationId: z.string().uuid('locationId must be a valid UUID'),
});

export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemSchema>;
export type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemSchema>;
