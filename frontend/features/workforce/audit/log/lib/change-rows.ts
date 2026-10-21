import type { JsonValue } from '../types/audit-log-types';

export interface ChangeRow {
  field: string;
  before: string;
  after: string;
}

const isRecord = (v: JsonValue | null): v is { [key: string]: JsonValue } => v !== null && typeof v === 'object' && !Array.isArray(v);

/** "lateness_grace" and "latenessGrace" both read "Lateness grace". */
export function fieldName(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' ').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function text(value: JsonValue | undefined): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  return Array.isArray(value) ? value.map((v) => text(v)).join(', ') : '(details)';
}

/**
 * The Before and After table of the drawer: one row per field that differs between the two snapshots. Plain values only; a nested value is
 * shown as "(details)" rather than dumped. Identical fields are left out, so a long snapshot shows only what moved.
 */
export function changeRows(before: JsonValue | null, after: JsonValue | null): ChangeRow[] {
  const b = isRecord(before) ? before : {};
  const a = isRecord(after) ? after : {};
  const keys = Object.keys({ ...b, ...a });
  return keys
    .filter((k) => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null))
    .map((k) => ({ field: fieldName(k), before: text(b[k]), after: text(a[k]) }));
}
