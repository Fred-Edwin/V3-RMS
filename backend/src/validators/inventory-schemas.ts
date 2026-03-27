import { z } from 'zod';

// ─── Suppliers ────────────────────────────────────────────────────────────────

export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
});

export const UpdateSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
  isActive: z.boolean().optional(),
});

// ─── Raw Ingredients ──────────────────────────────────────────────────────────

export const CreateIngredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  unit: z.string().min(1, 'Unit is required'),
  reorderThreshold: z.number().nonnegative().default(0),
});

export const UpdateIngredientSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  reorderThreshold: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

// ─── Ingredient Conversions ───────────────────────────────────────────────────

export const CreateIngredientConversionSchema = z.object({
  menuItemId: z.string().uuid('menuItemId must be a valid UUID'),
  quantityPerPortion: z.number().positive('Quantity per portion must be positive'),
});

// ─── Supplier Deliveries ──────────────────────────────────────────────────────

export const LogDeliverySchema = z.object({
  ingredientId: z.string().uuid('ingredientId must be a valid UUID'),
  supplierId: z.string().uuid('supplierId must be a valid UUID'),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().optional(),
});

// ─── Requisitions ─────────────────────────────────────────────────────────────

export const CreateRequisitionSchema = z.object({
  notes: z.string().optional(),
  isMidDay: z.boolean().optional().default(false),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid('menuItemId must be a valid UUID'),
        requestedQty: z.number().int().positive('Requested quantity must be a positive integer'),
      }),
    )
    .min(1, 'Requisition must have at least one item'),
});

export const DispatchRequisitionSchema = z.object({
  items: z
    .array(
      z.object({
        requisitionItemId: z.string().uuid('requisitionItemId must be a valid UUID'),
        dispatchedQty: z.number().int().nonnegative('Dispatched quantity must be non-negative'),
      }),
    )
    .min(1, 'Dispatch must include at least one item'),
});

export const ReceiveRequisitionSchema = z.object({
  items: z
    .array(
      z.object({
        requisitionItemId: z.string().uuid('requisitionItemId must be a valid UUID'),
        receivedQty: z.number().int().nonnegative('Received quantity must be non-negative'),
      }),
    )
    .min(1, 'Receipt must include at least one item'),
});

// ─── Stocktake ────────────────────────────────────────────────────────────────

const StocktakeEntrySchema = z
  .object({
    station: z.enum(['KITCHEN', 'BARISTA', 'WAITER']),
    menuItemId: z.string().uuid().optional(),
    consumableId: z.string().uuid().optional(),
    expectedQty: z.number().nonnegative(),
    actualQty: z.number().nonnegative(),
    note: z.string().optional(),
  })
  .refine(
    (d) => !!(d.menuItemId) !== !!(d.consumableId),
    'Exactly one of menuItemId or consumableId must be set',
  );

export const SubmitStocktakeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  entries: z.array(StocktakeEntrySchema).min(1, 'Stocktake must have at least one entry'),
});

export const SubmitCentralStocktakeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  entries: z
    .array(
      z.object({
        ingredientId: z.string().uuid('ingredientId must be a valid UUID'),
        actualQty: z.number().nonnegative('Actual quantity must be non-negative'),
      }),
    )
    .min(1, 'Central stocktake must have at least one entry'),
});

export const InventoryReportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  branchId: z.string().uuid().optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
export type CreateIngredientInput = z.infer<typeof CreateIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof UpdateIngredientSchema>;
export type CreateIngredientConversionInput = z.infer<typeof CreateIngredientConversionSchema>;
export type LogDeliveryInput = z.infer<typeof LogDeliverySchema>;
export type CreateRequisitionInput = z.infer<typeof CreateRequisitionSchema>;
export type DispatchRequisitionInput = z.infer<typeof DispatchRequisitionSchema>;
export type ReceiveRequisitionInput = z.infer<typeof ReceiveRequisitionSchema>;
export type SubmitStocktakeInput = z.infer<typeof SubmitStocktakeSchema>;
export type SubmitCentralStocktakeInput = z.infer<typeof SubmitCentralStocktakeSchema>;
export type InventoryReportQueryInput = z.infer<typeof InventoryReportQuerySchema>;

export const AllStocktakeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type AllStocktakeQueryInput = z.infer<typeof AllStocktakeQuerySchema>;
