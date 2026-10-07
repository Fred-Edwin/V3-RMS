/** `GET /inventory/audit-log` (API_CONTRACT.md §30.12). */
export type AuditArea = 'CATALOG' | 'SUPPLIERS' | 'RESTOCK_LEVELS' | 'PURCHASING' | 'PAYMENTS' | 'PREP';

/** The extra columns a Purchasing or Payments row carries: the purchase file it belongs to. */
export interface PurchasingAuditFields {
  action: string;
  document: string | null;
  detail: string;
  orderId: string;
  orderReference: string | null;
  supplierName: string;
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
}

export interface AuditLogPage {
  entries: AuditEntry[];
  actors: Array<{ id: string; name: string }>;
  pagination: { total: number; page: number; perPage: number; totalPages: number };
}

export interface AuditLogParams {
  area?: AuditArea;
  actorId?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}
