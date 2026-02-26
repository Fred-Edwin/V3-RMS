import { PrepStation } from '@prisma/client';
import { z } from 'zod';

const decimalPattern = /^\d+(\.\d{1,2})?$/;

const priceSchema = z
  .union([z.string(), z.number()])
  .transform((value) => {
    if (typeof value === 'number') {
      return value.toFixed(2);
    }

    return value.trim();
  })
  .refine((value) => decimalPattern.test(value), {
    message: 'Price must be a valid decimal with up to 2 decimal places',
  })
  .refine((value) => Number.parseFloat(value) > 0, {
    message: 'Price must be greater than zero',
  });

export const createCategorySchema = z.object({
  name: z.string().min(1),
  prepStation: z.nativeEnum(PrepStation),
  displayOrder: z.number().int().min(0),
});

export const updateCategorySchema = createCategorySchema
  .pick({
    name: true,
    prepStation: true,
    displayOrder: true,
  })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export const createItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  price: priceSchema,
});

export const updateItemSchema = createItemSchema
  .pick({
    categoryId: true,
    name: true,
    description: true,
    imageUrl: true,
    price: true,
  })
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export const availabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const menuQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});

export const availabilityQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
});

export const routeIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type MenuQueryInput = z.infer<typeof menuQuerySchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
