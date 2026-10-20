import { NotFoundError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import { workforceCan, type AccessSubject } from '../_shared/workforce-access';
import { resolveActor } from '../people/people-context';
import { needsYouQueries } from './needs-you-queries';
import { emptyBadges, type BadgeCounts, type NeedsYouContext, type NeedsYouRow, type NeedsYouSource } from './needs-you-types';
import { kindOrder, registeredSources, sourceForRow } from './sources/registry';

export const ROW_CAP = 500;

/** Without the capability the whole feature answers 404, so its existence is not revealed (6b X). */
function assertReader(subject: AccessSubject): void {
  if (!workforceCan(subject, 'needs_you.read')) throw new NotFoundError('Not found');
}

export async function contextFor(subject: AccessSubject, now: Date = new Date()): Promise<NeedsYouContext> {
  const { companyId } = await resolveActor(subject);
  return { companyId, now, enabledSiteIds: await needsYouQueries.enabledSiteIds(companyId) };
}

/** Runs one source; a failure drops its rows and marks the answer partial. It never produces a wrong count. */
async function guarded<T>(source: NeedsYouSource, run: () => Promise<T>, fallback: T): Promise<{ value: T; failed: boolean }> {
  try {
    return { value: await run(), failed: false };
  } catch (error) {
    logger.error({ err: error, source: source.id }, 'needs-you source failed');
    return { value: fallback, failed: true };
  }
}

export function orderRows(rows: NeedsYouRow[]): NeedsYouRow[] {
  const order = kindOrder();
  const rank = (kind: string): number => {
    const at = order.indexOf(kind);
    return at === -1 ? Number.MAX_SAFE_INTEGER : at;
  };
  return [...rows].sort((a, b) => a.since.localeCompare(b.since) || rank(a.kind) - rank(b.kind) || a.id.localeCompare(b.id));
}

export interface NeedsYouList {
  rows: Array<NeedsYouRow & { isNew: boolean }>;
  total: number;
  /** A source failed: the screen says "Some requests could not be loaded. Try again." */
  partial: boolean;
}

/** The card: every source's rows for this person, oldest first, at most 500, new since the person last opened Home tagged. */
export async function listNeedsYou(subject: AccessSubject, now: Date = new Date()): Promise<NeedsYouList> {
  assertReader(subject);
  const ctx = await contextFor(subject, now);
  const [results, lastSeen] = await Promise.all([
    Promise.all(registeredSources().map((s) => guarded(s, () => s.list(subject, ctx), [] as NeedsYouRow[]))),
    needsYouQueries.lastSeenHome(subject.id),
  ]);
  const ordered = orderRows(results.flatMap((r) => r.value));
  const rows = ordered.slice(0, ROW_CAP).map((r) => ({ ...r, isNew: lastSeen === null || new Date(r.since).getTime() > lastSeen.getTime() }));
  return { rows, total: ordered.length, partial: results.some((r) => r.failed) };
}

/** Counts only, for the menu badges. A source with no `count` is tallied from its rows, so a badge equals the card by construction. */
export async function countNeedsYou(subject: AccessSubject, now: Date = new Date()): Promise<{ total: number; badges: BadgeCounts; partial: boolean }> {
  assertReader(subject);
  const ctx = await contextFor(subject, now);
  const badges = emptyBadges();
  let total = 0;
  const results = await Promise.all(
    registeredSources().map((s) =>
      guarded(
        s,
        async (): Promise<Partial<BadgeCounts>> => {
          if (s.count) return s.count(subject, ctx);
          const tally: Partial<BadgeCounts> = {};
          for (const row of await s.list(subject, ctx)) if (row.badge) tally[row.badge] = (tally[row.badge] ?? 0) + 1;
          return tally;
        },
        {},
      ),
    ),
  );
  for (const r of results) {
    for (const [key, n] of Object.entries(r.value) as [keyof BadgeCounts, number][]) {
      badges[key] += n;
      total += n;
    }
  }
  return { total, badges, partial: results.some((r) => r.failed) };
}

/** Home was opened: everything older than now stops being "New". */
export async function markHomeSeen(subject: AccessSubject, now: Date = new Date()): Promise<{ seen: true }> {
  assertReader(subject);
  await needsYouQueries.markSeen(subject.id, now);
  return { seen: true };
}

/** Takes a decision back through the deciding module (it owns the 30 second window). 404 UNDO_UNAVAILABLE when nothing can. */
export async function undoRow(subject: AccessSubject, rowId: string): Promise<{ undone: true }> {
  assertReader(subject);
  const source = sourceForRow(rowId);
  if (!source?.undo) throw new NotFoundError('That cannot be taken back.', 'UNDO_UNAVAILABLE');
  await source.undo(subject, rowId);
  return { undone: true };
}
