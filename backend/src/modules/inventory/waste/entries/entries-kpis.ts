import { Prisma } from '@prisma/client';
import type { KpiCell } from '../../_shared/wire';
import { nairobiDay } from '../../stock/_shared/nairobi-time';
import { roleLabelOf } from '../../stock/_shared/person';
import { WASTE_REASON_TEXT, type WasteReason } from '../_shared/waste-contract';
import type { WasteLogRow } from '../_shared/waste-row';
import { entryValue } from '../_shared/waste-view';

/** "1,912": whole shillings with thousands separators. */
const groupedKes = (value: Prisma.Decimal): string => Math.round(value.toNumber()).toLocaleString('en-US');

const sum = (logs: WasteLogRow[]): Prisma.Decimal => logs.reduce((total, log) => total.plus(entryValue(log)), new Prisma.Decimal(0));

const entriesText = (n: number): string => `${n} ${n === 1 ? 'entry' : 'entries'}`;

/** "the Attendant", "the Store Manager": who reversed, as a phrase. */
const whoText = (roleLabels: string[]): string => {
  const names = [...new Set(roleLabels)].map((label) => (label === 'Store Attendant' ? 'the Attendant' : `the ${label}`));
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/**
 * The four cells of the Waste strip (Paper step 21), built from the data. A reversed entry's value counts for nothing, so
 * Today, Last 7 days and Most wasted use the entries still standing; the fourth cell counts the reversals.
 */
export const buildWasteKpis = (input: { last7: WasteLogRow[]; reversedLast7: WasteLogRow[]; todayStart: Date }): KpiCell[] => {
  const standing = input.last7.filter((log) => !log.reversedAt);
  const today = standing.filter((log) => log.createdAt >= input.todayStart);

  const byItem = new Map<string, { name: string; value: Prisma.Decimal; reasons: Map<WasteReason, number> }>();
  for (const log of standing) {
    const entry = byItem.get(log.inventoryItemId) ?? { name: log.inventoryItem.name, value: new Prisma.Decimal(0), reasons: new Map() };
    entry.value = entry.value.plus(entryValue(log));
    entry.reasons.set(log.reason, (entry.reasons.get(log.reason) ?? 0) + 1);
    byItem.set(log.inventoryItemId, entry);
  }
  const top = [...byItem.values()].sort((a, b) => b.value.comparedTo(a.value) || a.name.localeCompare(b.name))[0];
  const commonest = top ? [...top.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;

  const reversed = input.reversedLast7;
  const sameDay = reversed.length > 0 && reversed.every((log) => log.reversedAt && nairobiDay(log.reversedAt) === nairobiDay(log.createdAt));
  const prefix = reversed.length === 1 ? 'By' : reversed.length === 2 ? 'Both by' : 'All by';

  return [
    { key: 'today', label: 'TODAY', value: groupedKes(sum(today)), caption: `KES · ${entriesText(today.length)}`, tone: 'NEUTRAL' },
    { key: 'last7', label: 'LAST 7 DAYS', value: groupedKes(sum(standing)), caption: `KES · ${entriesText(standing.length)}`, tone: 'NEUTRAL' },
    top
      ? {
          key: 'most',
          label: 'MOST WASTED · 7 DAYS',
          value: top.name,
          caption: `KES ${groupedKes(top.value)}${commonest ? ` · mostly ${WASTE_REASON_TEXT[commonest].toLowerCase()}` : ''}`,
          tone: 'WARN',
        }
      : { key: 'most', label: 'MOST WASTED · 7 DAYS', value: '—', caption: 'Nothing wasted in 7 days', tone: 'NEUTRAL' },
    {
      key: 'reversed',
      label: 'REVERSED · 7 DAYS',
      value: String(reversed.length),
      caption: reversed.length === 0 ? 'Nothing reversed' : `${prefix} ${whoText(reversed.map((log) => (log.reversedBy ? roleLabelOf(log.reversedBy.role) : 'Unknown')))}${sameDay ? ', same day' : ''}`,
      tone: 'NEUTRAL',
    },
  ];
};
