/** `GET /inventory/audit-log` (API_CONTRACT.md §30.12). */
export type AuditArea = 'CATALOG' | 'SUPPLIERS' | 'RESTOCK_LEVELS';

export interface AuditEntry {
  id: string;
  at: string;
  actor: { id: string; name: string };
  area: AuditArea;
  what: string;
  reason: string | null;
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
