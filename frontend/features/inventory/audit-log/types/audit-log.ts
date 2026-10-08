/** `GET /inventory/audit-log` (API_CONTRACT.md §30.12). */
export type AuditArea =
  | 'CATALOG'
  | 'SUPPLIERS'
  | 'RESTOCK_LEVELS'
  | 'PURCHASING'
  | 'PAYMENTS'
  | 'PREP'
  | 'STOCK_COUNTS'
  | 'WASTE'
  | 'STOCK_ADJUSTMENTS'
  | 'REQUISITIONS'
  | 'DISPATCH'
  | 'DISCREPANCIES'
  | 'BRANCH_DAY'
  | 'BRANCH_WASTE';

/** The extra columns a Purchasing or Payments row carries: the purchase file it belongs to. */
export interface PurchasingAuditFields {
  action: string;
  document: string | null;
  detail: string;
  orderId: string;
  orderReference: string | null;
  supplierName: string;
}

/**
 * The record a Stock counts, Waste or Stock adjustments row points at: a count (`id` is its id), one item's stock card (`id` is
 * the item's id) or the ledger searched for an `ADJ-####`. `day` is the Nairobi day it happened, the ledger links' date range.
 */
export interface AuditRecordLink {
  kind: 'COUNT' | 'STOCK_CARD' | 'LEDGER_SEARCH';
  id: string;
  label: string;
  day?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  /** `role` is filled on Purchasing and Payments rows only. */
  actor: { id: string; name: string; role?: string };
  area: AuditArea;
  what: string;
  reason: string | null;
  /** Present on Purchasing and Payments rows only. */
  purchasing?: PurchasingAuditFields;
  /** Present on Stock counts, Waste and Stock adjustments rows only. */
  record?: AuditRecordLink;
}

export interface AuditLogPage {
  entries: AuditEntry[];
  actors: Array<{ id: string; name: string }>;
  /** The active branches, for the Branch filter. */
  branches: Array<{ id: string; name: string }>;
  pagination: { total: number; page: number; perPage: number; totalPages: number };
}

export interface AuditLogParams {
  area?: AuditArea;
  actorId?: string;
  branchId?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}
