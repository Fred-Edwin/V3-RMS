export type AuditArea = 'CATALOG' | 'SUPPLIERS' | 'RESTOCK_LEVELS';

export const AUDIT_AREAS: readonly AuditArea[] = ['CATALOG', 'SUPPLIERS', 'RESTOCK_LEVELS'];

/** One line of the Audit log: who, when, which area, what happened in plain words, and why (when a reason was given). */
export interface AuditEntry {
  /** Prefixed with the source ("item:", "supplier:", "restock:") so ids from different tables never collide. */
  id: string;
  at: string;
  actor: { id: string; name: string };
  area: AuditArea;
  what: string;
  reason: string | null;
}

export interface AuditLogPage {
  entries: AuditEntry[];
  /** People who made at least one change in the period, whatever the "who" filter, for the filter's list. */
  actors: Array<{ id: string; name: string }>;
  pagination: { total: number; page: number; perPage: number; totalPages: number };
}
