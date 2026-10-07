export type AuditArea = 'CATALOG' | 'SUPPLIERS' | 'RESTOCK_LEVELS' | 'PURCHASING' | 'PAYMENTS' | 'PREP';

export const AUDIT_AREAS: readonly AuditArea[] = ['CATALOG', 'SUPPLIERS', 'RESTOCK_LEVELS', 'PURCHASING', 'PAYMENTS', 'PREP'];

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
}

export interface AuditLogPage {
  entries: AuditEntry[];
  /** People who made at least one change in the period, whatever the "who" filter, for the filter's list. */
  actors: Array<{ id: string; name: string }>;
  pagination: { total: number; page: number; perPage: number; totalPages: number };
}
