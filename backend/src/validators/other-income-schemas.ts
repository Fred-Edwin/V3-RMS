import { z } from 'zod';
import { moneySchema } from './house-account-schemas';

// ── Params ────────────────────────────────────────────────────────────────────

export const OtherIncomeIdParamSchema = z.object({
  id: z.string().uuid('id param must be a valid UUID'),
});

// ── Categories ────────────────────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(60, 'Name must be 60 characters or fewer').trim(),
  branchId: z.string().uuid('branchId must be a valid UUID').nullable().optional(),
});

export const UpdateCategorySchema = z
  .object({
    name: z.string().min(1).max(60).trim().optional(),
    isActive: z.boolean().optional(),
    branchId: z.string().uuid('branchId must be a valid UUID').nullable().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined || data.isActive !== undefined || data.branchId !== undefined,
    { message: 'At least one field must be provided' },
  );

// ── Entries ───────────────────────────────────────────────────────────────────

export const CreateEntrySchema = z.object({
  categoryId: z.string().uuid('categoryId must be a valid UUID'),
  amount: moneySchema,
  paymentMethod: z.enum(['CASH', 'MPESA', 'CARD', 'SPLIT']),
  mpesaCode: z.string().max(20).trim().optional(),
  mpesaAmount: moneySchema.optional(),
  cashAmount: moneySchema.optional(),
  cardAmount: moneySchema.optional(),
  splitType: z.enum(['MPESA_CASH', 'MPESA_CARD', 'CASH_CARD']).optional(),
  description: z.string().max(200, 'Description must be 200 characters or fewer').trim().optional(),
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'entryDate must be YYYY-MM-DD format'),
  // Required when the actor is an org-level role (DIRECTOR, SYSTEM_ADMIN) with no branch on their token
  branchId: z.string().uuid('branchId must be a valid UUID').optional(),
});

export const ListEntriesSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoryId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;
export type ListEntriesInput = z.infer<typeof ListEntriesSchema>;
