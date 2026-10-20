/**
 * The API still spells a Site "organization" on the wire (backend `wire-names.ts`). Payroll code says "site", so every read is translated
 * once, here, and no screen or type ever sees the old words. Only plain objects and arrays are walked.
 */
const WIRE_TO_SITE: Record<string, string> = {
  organization: 'site',
  organizations: 'sites',
  organizationId: 'siteId',
  organizationIds: 'siteIds',
  organizationName: 'siteName',
};

export function fromWire<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => fromWire<unknown>(item)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) out[WIRE_TO_SITE[key] ?? key] = fromWire<unknown>(inner);
    return out as T;
  }
  return value as T;
}
