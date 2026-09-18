// Inventory — Milestone Two (Receiving & Supplier AP)
// Mirrors the FROZEN backend contract by hand (no pnpm workspace in this repo,
// so there is no shared package to import from).
//
// Authoritative source: backend/src/modules/inventory/receiving-validators.ts
// (Zod schemas) + receiving.types.ts (z.infer types). If this file's shape
// disagrees with that one, the backend file wins — fix this file, not the
// other way around.
//
// Wire-format rule: every decimal (quantity, price, total, outstanding)
// crosses the wire as a string, never a JS number.
//
// Plan: docs/features/inventory/milestone-2-plan.md §3.
//
// Terminology (owner decision 2026-09-16): user-facing labels say "what we
// owe" / "how overdue", not "AP" / "aging" — those are accountant's terms.
// Type and field names below stay technical (matching the backend contract);
// only display copy changes, at the component layer.

import type { Supplier, SupplierPaymentTerms } from './index';

// ─── Enums ──────────────────────────────────────────────────────────────────

export type ExpectedDeliveryStatus = 'AWAITING' | 'FULFILLED' | 'CANCELLED';

/**
 * DRAFT holds an unsigned receipt — no ledger rows exist yet. The
 * RECEIVED_INVOICE_PENDING / RECEIVED_PAID split is the payment-terms branch
 * that decides whether a what-we-owe row is ever created.
 */
export type GoodsReceiptStatus =
  | 'DRAFT'
  | 'RECEIVED_INVOICE_PENDING'
  | 'RECEIVED_PAID'
  | 'INVOICE_RECORDED'
  | 'CANCELLED';

export type SupplierInvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

/** Deliberately independent of `SupplierInvoiceStatus` — a disputed invoice still ages and can still be paid. */
export type DisputeStatus = 'OPEN' | 'RESOLVED';

export type SupplierPaymentMethod = 'BANK' | 'CASH' | 'MPESA';

// ─── Expected deliveries (Stage 1 — estimates, never a PO) ─────────────────

export interface ExpectedDeliveryLine {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantity: string;
  buyUnit: string;
  usageUnit: string;
  estimatedUnitPrice: string;
}

/**
 * AMENDMENT 2026-09-17 (New purchase redesign, owner-approved in Paper —
 * artboards X9J-0/XXR-0): supplier is optional — a purchase list may be
 * saved with no supplier (a pure shopping list). `supplierId`/`supplierName`
 * are nullable (not empty-string sentinels, matching `estimatedTotal`/
 * `expectedDate`'s existing convention); `paymentTerms` is nullable in
 * lockstep, since terms are meaningless with no supplier chosen. See
 * backend/src/modules/inventory/receiving-validators.ts's header comment for
 * the full amendment record.
 */
export interface ExpectedDeliverySummary {
  id: string;
  reference: string;
  supplierId: string | null;
  /** Null when supplierId is null. Render "No supplier" at the display layer. */
  supplierName: string | null;
  paymentTerms: SupplierPaymentTerms | null;
  status: ExpectedDeliveryStatus;
  itemSummary: string;
  lineCount: number;
  expectedDate: string | null;
  /** Null for STORE_ATTENDANT responses by design — not merely hidden client-side. */
  estimatedTotal: string | null;
  isOverdue: boolean;
  ageLabel: string;
  createdAt: string;
}

/**
 * AMENDMENT 2026-09-17 (S6 follow-up): mirrors backend's
 * ExpectedDeliveryDetailSchema — added so New Goods Receipt can prefill
 * from the linked delivery instead of starting blank.
 */
export interface ExpectedDeliveryDetail extends ExpectedDeliverySummary {
  lines: ExpectedDeliveryLine[];
}

export interface CreateExpectedDeliveryInput {
  /** Optional (AMENDMENT 2026-09-17) — a purchase list may be saved with no supplier. */
  supplierId?: string;
  /** Optional in lockstep with supplierId. */
  paymentTerms?: SupplierPaymentTerms;
  expectedDate?: string;
  lines: Array<{
    inventoryItemId: string;
    quantity: string;
    estimatedUnitPrice: string;
  }>;
}

export interface ListExpectedDeliveriesQuery {
  status?: ExpectedDeliveryStatus;
  supplierId?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

/**
 * AMENDMENT 2026-09-17 (post-freeze, UI refinement session): feeds the New
 * Purchase item combobox's "Recently purchased from this supplier" section.
 * Mirrors backend/src/modules/inventory/receiving-validators.ts's
 * RecentSupplierItemSchema.
 */
export interface RecentSupplierItem {
  inventoryItemId: string;
  itemName: string;
  buyUnit: string;
  lastUnitPrice: string;
  lastPurchasedAt: string;
}

// ─── Goods receipts (Stage 2) ───────────────────────────────────────────────

export interface GoodsReceiptLine {
  id: string;
  inventoryItemId: string;
  itemName: string;
  quantityBuyUnit: string;
  buyUnit: string;
  quantityUsageUnit: string;
  usageUnit: string;
  unitPrice: string;
  lineTotal: string;
  /** Persisted at signing — never recomputed, since currentCost has moved on by the time this is read back. */
  priceAlert: {
    percentAboveLast: string;
    previousPrice: string;
    acceptedByName: string | null;
  } | null;
}

export interface GoodsReceiptDetail {
  id: string;
  reference: string;
  supplierId: string;
  supplierName: string;
  expectedDeliveryId: string | null;
  paymentTerms: SupplierPaymentTerms;
  status: GoodsReceiptStatus;
  supplierDocNumber: string | null;
  supplierDocDate: string | null;
  receiptTotal: string;
  lines: GoodsReceiptLine[];
  signature: {
    signedByName: string;
    signedByRole: string;
    signedAt: string;
  } | null;
  linkedInvoice: { id: string; invoiceNumber: string } | null;
  createdAt: string;
}

export interface CreateGoodsReceiptInput {
  supplierId: string;
  expectedDeliveryId?: string;
  paymentTerms: SupplierPaymentTerms;
  supplierDocNumber?: string;
  supplierDocDate?: string;
  lines: Array<{
    inventoryItemId: string;
    quantityBuyUnit: string;
    unitPrice: string;
  }>;
}

/** The ledger-writing action — writes one RECEIVE transaction per line and updates latest-price costing, atomically. */
export interface SignGoodsReceiptInput {
  pin: string;
  acceptedPriceAlerts: string[];
}

/**
 * AMENDMENT 2026-09-17 (post-freeze): mirrors backend's UpdateGoodsReceiptSchema.
 * supplierId is deliberately absent — immutable once a receipt is created.
 * All fields optional (partial update); `lines`, if present, replaces the
 * full line set (backend requires min 1 when provided).
 */
export interface UpdateGoodsReceiptInput {
  expectedDeliveryId?: string;
  paymentTerms?: SupplierPaymentTerms;
  supplierDocNumber?: string;
  supplierDocDate?: string;
  lines?: Array<{
    inventoryItemId: string;
    quantityBuyUnit: string;
    unitPrice: string;
  }>;
}

/**
 * AMENDMENT 2026-09-18 (S8): mirrors backend's `ListGoodsReceiptsQuerySchema`
 * — missing from this file until now. Used by the "RECEIPTS TO BUNDLE"
 * picker in Record supplier invoice (`status: 'RECEIVED_INVOICE_PENDING'`).
 */
export interface ListGoodsReceiptsQuery {
  status?: GoodsReceiptStatus;
  supplierId?: string;
  limit?: number;
  cursor?: string;
}

// ─── Supplier invoices (Stage 10, Flow 14) ─────────────────────────────────

export interface SupplierInvoice {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  /** Computed once at creation as invoiceDate + supplier.paymentDays, then stored. */
  dueDate: string;
  amountBilled: string;
  outstanding: string;
  status: SupplierInvoiceStatus;
  dispute: {
    status: DisputeStatus;
    ourFigure: string;
    reason: string;
  } | null;
  goodsReceiptIds: string[];
  createdAt: string;
}

/**
 * One input for both "Save invoice" and "Record at billed — open dispute" —
 * the only difference is whether `dispute` is set on an otherwise identical
 * write. "Hold" is a client-side no-op that never calls this at all.
 */
export interface CreateSupplierInvoiceInput {
  supplierId: string;
  goodsReceiptIds: string[];
  invoiceNumber: string;
  invoiceDate: string;
  amountBilled: string;
  dispute?: {
    ourFigure: string;
    reason: string;
  };
}

/** The Accountant's reconciliation adjustment — reason is mandatory. */
export interface CreateInvoiceAdjustmentInput {
  amount: string;
  reason: string;
}

// ─── Supplier payments (Flow 15) ────────────────────────────────────────────

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: string;
  paidAt: string;
  method: SupplierPaymentMethod;
  reference: string | null;
  allocations: Array<{
    supplierInvoiceId: string;
    invoiceNumber: string;
    amount: string;
  }>;
  reversalOfId: string | null;
  recordedByName: string;
  createdAt: string;
}

/** Overpayment (allocations < amount) is allowed, not an error — the excess becomes a derived supplier credit. */
export interface CreateSupplierPaymentInput {
  supplierId: string;
  amount: string;
  paidAt: string;
  method: SupplierPaymentMethod;
  reference?: string;
  allocations: Array<{
    supplierInvoiceId: string;
    amount: string;
  }>;
}

export interface ReverseSupplierPaymentInput {
  reason: string;
}

// ─── Read models: what we owe / how overdue ─────────────────────────────────
// Derived at query time, never stored/cached — see plan §1.5. "What we owe"
// / "how overdue" are the user-facing terms (owner decision 2026-09-16);
// field names below stay technical, matching the backend contract.

export interface AgingBuckets {
  current: string;
  days1To30: string;
  days31To60: string;
  days61To90: string;
  days90Plus: string;
}

export interface SupplierApRow {
  supplierId: string;
  supplierName: string;
  paymentTerms: SupplierPaymentTerms;
  lastInvoiceDate: string | null;
  invoiced: string;
  paid: string;
  outstanding: string;
  buckets: AgingBuckets;
  disputedCount: number;
}

export interface ApSummary {
  totalInvoiced: string;
  totalPaid: string;
  totalOutstanding: string;
  supplierCount: number;
  suppliersWithBalance: number;
}

/**
 * `GET /inventory/ap/suppliers/:id` (`VND-0`) — profile, the what-we-owe
 * bucket panel data (`row`, same derivation `SupplierApRow` uses — plan
 * §1.5's reconciliation invariant), invoice list, payment list, and purchase
 * history. AMENDMENT 2026-09-18 (S8): this type didn't exist before — the
 * endpoint previously returned only `{ row, invoices, payments }`, missing
 * `supplier` and `purchaseHistory`, both named in-scope for Supplier detail
 * by plan §0.
 */
export interface SupplierApDetail {
  supplier: Supplier;
  row: SupplierApRow;
  invoices: SupplierInvoice[];
  payments: SupplierPayment[];
  purchaseHistory: GoodsReceiptDetail[];
}

/** Three tiles, not four — `IN TRANSIT` was dropped, not deferred (owner decision 2026-09-16). */
export interface PurchasingSummary {
  expected: { count: number; overdue: number };
  awaitingInvoice: { count: number; oldestDays: number | null };
  owed: { amount: string; over30Count: number };
}

/**
 * AMENDMENT 2026-09-16 (post-freeze, during S3): added — the History band's
 * response shape was missed at freeze time. `type` matches
 * `frontend/features/inventory/components/purchasing-history-row.tsx`'s
 * existing discriminant (`expectedDelivery` / `goodsReceipt`, camelCase) —
 * that component was built first (S0) and is the harder thing to re-diff, so
 * the wire format conforms to it. S3 can only emit `expectedDelivery` rows
 * for real; `goodsReceipt` rows arrive with S4.
 */
export type PurchasingRowStatusTone = 'neutral' | 'error' | 'info';

interface PurchasingRowAction {
  label: string;
  emphasized?: boolean;
}

export type PurchasingHistoryRow =
  | {
      type: 'expectedDelivery';
      id: string;
      supplierName: string;
      paymentTermsLabel: string;
      detailLabel: string;
      ageLabel: string;
      statusLabel: string;
      statusTone: PurchasingRowStatusTone;
      actions: [PurchasingRowAction, PurchasingRowAction];
    }
  | {
      type: 'goodsReceipt';
      id: string;
      title: string;
      subtitleLabel: string;
      detailLabel: string;
      ageLabel: string;
      statusLabel: string;
      statusTone: PurchasingRowStatusTone;
      actions: [PurchasingRowAction, PurchasingRowAction];
    };

export interface ListSupplierApQuery {
  search?: string;
  terms?: SupplierPaymentTerms;
  hasBalance?: boolean;
  agingBucket?: 'current' | 'days1To30' | 'days31To60' | 'days61To90' | 'days90Plus';
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}
