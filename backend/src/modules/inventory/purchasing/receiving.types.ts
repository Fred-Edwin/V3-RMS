/**
 * Inventory — Milestone Two (Receiving & Supplier AP)
 * FROZEN API CONTRACT — TypeScript types.
 *
 * FROZEN 2026-09-16 (playbook Step 6) — see the header of
 * `receiving-validators.ts` for the amendment process and how each of the
 * plan's §7 open questions was resolved.
 *
 * Every type here is inferred from the Zod schemas in
 * `receiving-validators.ts` — the schemas are the single definition, these are
 * the compile-time view of them. Do not hand-write a type that duplicates a
 * schema; infer it.
 *
 * Plan: `docs/features/inventory/milestone-2-plan.md` §3.
 * Mirrored (by hand) in `frontend/features/inventory/types/`.
 */
import type { z } from 'zod';

import type {
  AgingBucketsSchema,
  ApSummarySchema,
  CreateExpectedDeliverySchema,
  CreateGoodsReceiptSchema,
  CreateInvoiceAdjustmentSchema,
  CreateSupplierInvoiceSchema,
  CreateSupplierPaymentSchema,
  ExpectedDeliveryDetailSchema,
  ExpectedDeliveryLineSchema,
  ExpectedDeliverySummarySchema,
  GoodsReceiptDetailSchema,
  GoodsReceiptLineSchema,
  ListExpectedDeliveriesQuerySchema,
  ListGoodsReceiptsQuerySchema,
  ListSupplierApQuerySchema,
  PurchasingHistoryRowSchema,
  PurchasingSummarySchema,
  RecentSupplierItemSchema,
  RecentSupplierItemsQuerySchema,
  ReverseSupplierPaymentSchema,
  SignGoodsReceiptSchema,
  SupplierApDetailSchema,
  SupplierApRowSchema,
  SupplierInvoiceSchema,
  SupplierPaymentCreatedSchema,
  SupplierPaymentSchema,
  UpdateGoodsReceiptSchema,
  disputeStatusSchema,
  expectedDeliveryStatusSchema,
  goodsReceiptStatusSchema,
  supplierInvoiceStatusSchema,
  supplierPaymentMethodSchema,
} from './receiving-validators';

// --- Enums -----------------------------------------------------------------

export type ExpectedDeliveryStatus = z.infer<typeof expectedDeliveryStatusSchema>;
export type GoodsReceiptStatus = z.infer<typeof goodsReceiptStatusSchema>;
export type SupplierInvoiceStatus = z.infer<typeof supplierInvoiceStatusSchema>;
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;
export type SupplierPaymentMethod = z.infer<typeof supplierPaymentMethodSchema>;

// --- Expected deliveries ---------------------------------------------------

export type ExpectedDeliveryLine = z.infer<typeof ExpectedDeliveryLineSchema>;
export type ExpectedDeliverySummary = z.infer<typeof ExpectedDeliverySummarySchema>;
export type ExpectedDeliveryDetail = z.infer<typeof ExpectedDeliveryDetailSchema>;
export type CreateExpectedDeliveryInput = z.infer<typeof CreateExpectedDeliverySchema>;
export type ListExpectedDeliveriesQuery = z.infer<typeof ListExpectedDeliveriesQuerySchema>;
export type RecentSupplierItem = z.infer<typeof RecentSupplierItemSchema>;
export type RecentSupplierItemsQuery = z.infer<typeof RecentSupplierItemsQuerySchema>;

// --- Goods receipts --------------------------------------------------------

export type GoodsReceiptLine = z.infer<typeof GoodsReceiptLineSchema>;
export type GoodsReceiptDetail = z.infer<typeof GoodsReceiptDetailSchema>;
export type CreateGoodsReceiptInput = z.infer<typeof CreateGoodsReceiptSchema>;
export type UpdateGoodsReceiptInput = z.infer<typeof UpdateGoodsReceiptSchema>;
export type ListGoodsReceiptsQuery = z.infer<typeof ListGoodsReceiptsQuerySchema>;
export type SignGoodsReceiptInput = z.infer<typeof SignGoodsReceiptSchema>;

// --- Supplier AP -----------------------------------------------------------

export type SupplierInvoice = z.infer<typeof SupplierInvoiceSchema>;
export type CreateSupplierInvoiceInput = z.infer<typeof CreateSupplierInvoiceSchema>;
export type CreateInvoiceAdjustmentInput = z.infer<typeof CreateInvoiceAdjustmentSchema>;
export type SupplierPayment = z.infer<typeof SupplierPaymentSchema>;
export type SupplierPaymentCreated = z.infer<typeof SupplierPaymentCreatedSchema>;
export type CreateSupplierPaymentInput = z.infer<typeof CreateSupplierPaymentSchema>;
export type ReverseSupplierPaymentInput = z.infer<typeof ReverseSupplierPaymentSchema>;

// --- Read models -----------------------------------------------------------

export type AgingBuckets = z.infer<typeof AgingBucketsSchema>;
export type SupplierApRow = z.infer<typeof SupplierApRowSchema>;
export type SupplierApDetail = z.infer<typeof SupplierApDetailSchema>;
export type ApSummary = z.infer<typeof ApSummarySchema>;
export type PurchasingSummary = z.infer<typeof PurchasingSummarySchema>;
export type PurchasingHistoryRow = z.infer<typeof PurchasingHistoryRowSchema>;
export type ListSupplierApQuery = z.infer<typeof ListSupplierApQuerySchema>;
