import { Prisma } from '@prisma/client';
import type { KpiCell } from '../../_shared/wire';
import { WASTE_REASON_TEXT, type WasteReason } from '../_shared/waste-contract';
import { entryValue } from '../_shared/waste-view';

/** What the strip needs of a log: the numbers, the item, the department it sits in and, when reversed, who reversed it. */
export type KpiLog = {
  createdAt: Date;
  reversedAt: Date | null;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  reason: WasteReason;
  siteId: string;
  inventoryItemId: string;
  inventoryItem: { name: string };
  location: { departmentId: string | null; department: { id: string; name: string } | null };
  reversedBy: { id: string; name: string; departmentId: string | null } | null;
};

/** "1,912": whole shillings with thousands separators. */
const groupedKes = (value: Prisma.Decimal): string => Math.round(value.toNumber()).toLocaleString('en-US');

const sum = (logs: KpiLog[]): Prisma.Decimal => logs.reduce((total, log) => total.plus(entryValue(log)), new Prisma.Decimal(0));

const entriesText = (n: number): string => `${n} ${n === 1 ? 'entry' : 'entries'}`;

/** "Grace W.": first name and the initial of the last. */
export const shortName = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0).toUpperCase()}.`;
};

/**
 * "Both by their own department" when every reversal was made inside the entry's own department; otherwise the people from outside
 * it are named ("1 by Grace W."), and the own-department ones are counted first when there are both.
 */
export const reversedCaption = (reversed: KpiLog[]): string => {
  if (reversed.length === 0) return 'Nothing reversed';
  const isOwn = (log: KpiLog): boolean => log.reversedBy !== null && log.location.departmentId !== null && log.reversedBy.departmentId === log.location.departmentId;
  const own = reversed.filter(isOwn);
  const others = reversed.filter((log) => !isOwn(log));
  if (others.length === 0) return reversed.length === 1 ? 'By its own department' : reversed.length === 2 ? 'Both by their own department' : 'Each by its own department';
  const names = [...new Set(others.map((log) => (log.reversedBy ? shortName(log.reversedBy.name) : 'someone')))];
  const by = `${others.length} by ${names.length <= 2 ? names.join(' and ') : `${names.length} people`}`;
  return own.length === 0 ? by : `${own.length} by their own department · ${by}`;
};

/**
 * The four cells of the Branch waste strip (Paper W6, W8), built from the data. A reversed entry's value counts for nothing, so Today,
 * Last 7 days and Most wasted use the entries still standing; the fourth cell counts the reversals made in the last 7 days. `scope`
 * `ONE_BRANCH` names the department in Most wasted and leaves the branch count out; `MANY_BRANCHES` does the opposite (W8).
 */
export const buildBranchWasteKpis = (input: { last7: KpiLog[]; reversedLast7: KpiLog[]; todayStart: Date; scope: 'ONE_BRANCH' | 'MANY_BRANCHES' }): KpiCell[] => {
  const standing = input.last7.filter((log) => !log.reversedAt);
  const today = standing.filter((log) => log.createdAt >= input.todayStart);

  const byItem = new Map<string, { name: string; value: Prisma.Decimal; reasons: Map<WasteReason, number>; departments: Map<string, { name: string; value: Prisma.Decimal }> }>();
  for (const log of standing) {
    const entry = byItem.get(log.inventoryItemId) ?? { name: log.inventoryItem.name, value: new Prisma.Decimal(0), reasons: new Map(), departments: new Map() };
    const value = entryValue(log);
    entry.value = entry.value.plus(value);
    entry.reasons.set(log.reason, (entry.reasons.get(log.reason) ?? 0) + 1);
    if (log.location.department) {
      const dept = entry.departments.get(log.location.department.id) ?? { name: log.location.department.name, value: new Prisma.Decimal(0) };
      dept.value = dept.value.plus(value);
      entry.departments.set(log.location.department.id, dept);
    }
    byItem.set(log.inventoryItemId, entry);
  }
  const top = [...byItem.values()].sort((a, b) => b.value.comparedTo(a.value) || a.name.localeCompare(b.name))[0];
  const commonest = top ? [...top.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
  const topDepartment = top ? [...top.departments.values()].sort((a, b) => b.value.comparedTo(a.value) || a.name.localeCompare(b.name))[0] : undefined;

  const branchesToday = new Set(today.map((log) => log.siteId)).size;
  const todayCaption = `KES · ${entriesText(today.length)}${input.scope === 'MANY_BRANCHES' ? ` · ${branchesToday} ${branchesToday === 1 ? 'branch' : 'branches'}` : ''}`;
  const mostCaption = top
    ? [`KES ${groupedKes(top.value)}`, ...(input.scope === 'ONE_BRANCH' && topDepartment ? [topDepartment.name] : []), ...(commonest ? [`mostly ${WASTE_REASON_TEXT[commonest].toLowerCase()}`] : [])].join(' · ')
    : 'Nothing wasted in 7 days';

  return [
    { key: 'today', label: 'TODAY', value: groupedKes(sum(today)), caption: todayCaption, tone: 'NEUTRAL' },
    { key: 'last7', label: 'LAST 7 DAYS', value: groupedKes(sum(standing)), caption: `KES · ${entriesText(standing.length)}`, tone: 'NEUTRAL' },
    { key: 'most', label: 'MOST WASTED · 7 DAYS', value: top ? top.name : '—', caption: mostCaption, tone: top ? 'WARN' : 'NEUTRAL' },
    { key: 'reversed', label: 'REVERSED · 7 DAYS', value: String(input.reversedLast7.length), caption: reversedCaption(input.reversedLast7), tone: 'NEUTRAL' },
  ];
};
