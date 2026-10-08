/**
 * Every area the Area menu lists (Paper step 58). The Central Store areas have sources today. The five Branches areas
 * (`REQUISITIONS` to `BRANCH_WASTE`) are listed now and stay empty until the block that builds each adds its source
 * (`AUDIT_AREAS_WITHOUT_SOURCE`).
 */
export const AUDIT_AREAS = [
  'CATALOG',
  'SUPPLIERS',
  'RESTOCK_LEVELS',
  'PURCHASING',
  'PAYMENTS',
  'PREP',
  'STOCK_COUNTS',
  'WASTE',
  'STOCK_ADJUSTMENTS',
  'REQUISITIONS',
  'DISPATCH',
  'DISCREPANCIES',
  'BRANCH_DAY',
  'BRANCH_WASTE',
] as const;
export type AuditArea = (typeof AUDIT_AREAS)[number];

/** Listed in the Area menu, answered with nothing until the block that owns each one adds its source. */
export const AUDIT_AREAS_WITHOUT_SOURCE: readonly AuditArea[] = ['REQUISITIONS', 'DISPATCH', 'DISCREPANCIES', 'BRANCH_DAY', 'BRANCH_WASTE'];

/**
 * The record a derived row points at, so the screen can draw the link: a count (`COUNT`, `id` is the count's id), a day on one
 * item's stock card (`STOCK_CARD`, `id` is the item's id), or the ledger searched for a reference (`LEDGER_SEARCH`, `id` is the
 * `ADJ-####`). `day` is the Nairobi day the entry happened, which the ledger links use as their date range.
 */
export interface AuditRecordLink {
  kind: 'COUNT' | 'STOCK_CARD' | 'LEDGER_SEARCH';
  id: string;
  label: string;
  day?: string;
}

/** The extra columns a Purchasing or Payments row carries (the purchase file it belongs to). */
export interface PurchasingAuditFields {
  action: string;
  document: string | null;
  detail: string;
  orderId: string;
  orderReference: string | null;
  supplierName: string;
}

/** One line of the Audit log: who, when, which area, what happened in plain words, and why (when a reason was given). */
export interface AuditEntry {
  /** Prefixed with the source ("item:", "supplier:", "restock:", "purchasing:", "recipe:") so ids from different tables never collide. */
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
  /** People who made at least one change in the period, whatever the "who" filter, for the filter's list. */
  actors: Array<{ id: string; name: string }>;
  /** The active branches, for the Branch filter (Lane 0). */
  branches: Array<{ id: string; name: string }>;
  pagination: { total: number; page: number; perPage: number; totalPages: number };
}
