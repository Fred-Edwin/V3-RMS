import { countReadsRepository } from './count-reads-repository';
import { nairobiDayEnd, nairobiDayStart } from './count-time';

/**
 * The ONLY door other sub-modules (Stock Overview and All items) use to read Counting's data: five functions, never Counting's
 * repositories (contract §10.1). The signatures are fixed, because Back end B builds on them.
 */

export type TodaysCount = {
  id: string;
  reference: string;
  sectionsText: string;
  counterName: string;
  startedAt: Date;
  signedAt: Date | null;
  status: 'OPEN' | 'SUBMITTED' | 'APPROVED';
  selfSigned: boolean;
};

/** Counts started or signed on the Nairobi day of `now`, the latest activity first. */
export const todaysCounts = async (siteId: string, now: Date): Promise<TodaysCount[]> => {
  const rows = await countReadsRepository.countsInWindow(siteId, nairobiDayStart(now), nairobiDayEnd(now));
  return rows
    .map((row) => ({
      id: row.id,
      reference: row.reference,
      sectionsText: (row.scopeNames.length > 0 ? row.scopeNames : row.firstItemNames).join(', '),
      counterName: row.counterName,
      startedAt: row.startedAt,
      signedAt: row.signedAt,
      status: row.status,
      selfSigned: row.selfSigned,
    }))
    .sort((a, b) => (b.signedAt ?? b.startedAt).getTime() - (a.signedAt ?? a.startedAt).getTime());
};

export type LongestWithoutCount = {
  kind: 'SECTION' | 'ITEM';
  refId: string;
  name: string;
  /** Sections only. */
  itemCount: number | null;
  /** Items only: the section the item sits in. */
  sectionName: string | null;
  lastCountedAt: Date | null;
};

const longestFirst = (a: LongestWithoutCount, b: LongestWithoutCount): number => {
  if (a.lastCountedAt === null && b.lastCountedAt !== null) return -1;
  if (a.lastCountedAt !== null && b.lastCountedAt === null) return 1;
  if (a.lastCountedAt && b.lastCountedAt && a.lastCountedAt.getTime() !== b.lastCountedAt.getTime()) return a.lastCountedAt.getTime() - b.lastCountedAt.getTime();
  if (a.kind !== b.kind) return a.kind === 'SECTION' ? -1 : 1;
  return a.name.localeCompare(b.name);
};

/**
 * The sections, and the items inside counted sections, that have gone longest without a count; never-counted sorts first.
 * A section's last count is the latest signed count that had it in scope. An ITEM is listed only when its own last count is older
 * than its section's (it was skipped on the section's counts), since a section that was never counted is already listed whole.
 */
export const longestWithoutCount = async (siteId: string, _now: Date, limit: number): Promise<LongestWithoutCount[]> => {
  const [sections, items] = await Promise.all([countReadsRepository.sectionsLastCounted(siteId), countReadsRepository.itemsLastCounted(siteId)]);
  const sectionLast = new Map(sections.map((s) => [s.id, s.lastCountedAt]));

  const rows: LongestWithoutCount[] = [
    ...sections.map((s): LongestWithoutCount => ({ kind: 'SECTION', refId: s.id, name: s.name, itemCount: s.itemCount, sectionName: null, lastCountedAt: s.lastCountedAt })),
    ...items.flatMap((item): LongestWithoutCount[] => {
      const sectionCountedAt = sectionLast.get(item.sectionId) ?? null;
      if (sectionCountedAt === null) return [];
      if (item.lastCountedAt !== null && item.lastCountedAt >= sectionCountedAt) return [];
      return [{ kind: 'ITEM', refId: item.id, name: item.name, itemCount: null, sectionName: item.sectionName, lastCountedAt: item.lastCountedAt }];
    }),
  ];
  return rows.sort(longestFirst).slice(0, Math.max(0, limit));
};

/** The latest SUBMITTED or APPROVED count that gave each item a number, with its reference. Items never counted are absent. */
export const lastCountedByItem = async (siteId: string, itemIds: string[]): Promise<Map<string, { at: Date; reference: string }>> => {
  const rows = await countReadsRepository.lastCountedByItem(siteId, itemIds);
  return new Map(rows.map((r) => [r.itemId, { at: r.at, reference: r.reference }]));
};

/** The name of the section each item sits in. Items in no section are absent. */
export const sectionNamesByItem = async (siteId: string, itemIds: string[]): Promise<Map<string, string>> => {
  const rows = await countReadsRepository.sectionNamesByItem(siteId, itemIds);
  return new Map(rows.map((r) => [r.itemId, r.name]));
};

/** Live items in no section ("Not in any section"). */
export const unsectionedCount = (siteId: string): Promise<number> => countReadsRepository.unsectionedCount(siteId);
