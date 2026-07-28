import { z } from 'zod';
import { nonNegativeQuantitySchema } from './inventory-item-schemas';

export const SupplierIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export const SupplierItemParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
  itemId: z.string().uuid('itemId param must be a valid UUID'),
});

export const CreateSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  contactName: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().email('Must be a valid email').optional(),
});

export const UpdateSupplierSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    contactName: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    email: z.string().trim().email('Must be a valid email').nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const AssignSupplierItemSchema = z.object({
  inventoryItemId: z.string().uuid('inventoryItemId must be a valid UUID'),
  isDefault: z.boolean().optional(),
  lastPrice: nonNegativeQuantitySchema.optional(),
});

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
export type AssignSupplierItemInput = z.infer<typeof AssignSupplierItemSchema>;
