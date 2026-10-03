import { describePayMethodChange } from '../suppliers/supplier-pay-history';
import { formatKes, trimDecimal } from '../catalog/item-history';
import type { InventoryItemChangeKind, SupplierAuditAction } from '@prisma/client';

/**
 * The sentences on the Audit log. Plain words, no account numbers (the supplier audit snapshots are already masked,
 * and `describePayMethodChange` only names which fields changed).
 */

type Json = Record<string, unknown> | null;

const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

/** "Wheat flour: changed the pack…", "Retired Sugar, brown", "Created Brown sugar". */
export function describeItemChange(kind: InventoryItemChangeKind, itemName: string, summary: string): string {
  switch (kind) {
    case 'CREATED':
      return `Created ${itemName}`;
    case 'RETIRED':
      return `Retired ${itemName}`;
    case 'RESTORED':
      return `Restored ${itemName}`;
    default:
      return `${itemName}: ${summary}`;
  }
}

const STATUS_WORDS: Record<string, string> = { ACTIVE: 'made active', ON_HOLD: 'put on hold', ARCHIVED: 'archived' };

/** The reason a supplier audit row carries in its `after` snapshot, when it has one. */
export const auditReason = (after: Json): string | null => str(after?.reason);

export function describeSupplierAudit(
  action: SupplierAuditAction,
  supplierName: string,
  before: Json,
  after: Json,
  itemName: string | null,
): string {
  const item = itemName ?? 'an item';
  switch (action) {
    case 'PAY_METHOD_CREATED':
    case 'PAY_METHOD_UPDATED':
    case 'PAY_METHOD_DELETED':
    case 'PAY_METHOD_DEFAULT_CHANGED':
      return `${supplierName}: ${describePayMethodChange(action, before, after).replace(/^./, (c) => c.toLowerCase())}`;
    case 'STATUS_CHANGED':
      return `${supplierName}: ${STATUS_WORDS[str(after?.status) ?? ''] ?? 'status changed'}`;
    case 'PREFERRED_SET':
      return `${supplierName}: made the preferred supplier for ${item}`;
    case 'PREFERRED_CONFIRMED':
      return `${supplierName}: confirmed as the preferred supplier for ${item}`;
    case 'LINE_PRICE_SET': {
      const now = str(after?.price);
      const was = str(before?.price);
      const price = now ? formatKes(now) : 'a price';
      return `${supplierName}: price for ${item} set to ${price}${was ? ` (was ${formatKes(was)})` : ''}`;
    }
  }
}

/** "Kitchen: Chapati dough 12 → 14 kg", "Central Store: Sugar 150 → 180 kg", "Set to", "Cleared". */
export function describeRestockChange(
  place: string,
  itemName: string,
  unit: string,
  oldLevel: string | null,
  newLevel: string | null,
): string {
  const old = oldLevel === null ? null : trimDecimal(oldLevel);
  const next = newLevel === null ? null : trimDecimal(newLevel);
  if (next === null) return `${place}: ${itemName} level cleared${old ? ` (was ${old} ${unit})` : ''}`;
  if (old === null) return `${place}: ${itemName} level set to ${next} ${unit}`;
  return `${place}: ${itemName} ${old} → ${next} ${unit}`;
}

export const describeSupplierCreated = (name: string, code: string): string => `Created supplier ${name} (${code})`;
