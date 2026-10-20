import { areaOf, describeEntry, searchTextOf } from '../_shared/audit/audit-describe';
import type { AuditCategoryCode } from '../_shared/audit/audit.types';
import { auditReadRepository } from './audit-read-repository';
import { asJson } from './audit-rows';

const BATCH = 1_000;

/** Every active company. Returns how many index rows were written. */
export async function backfillAllAuditIndexes(): Promise<number> {
  let written = 0;
  for (const { id } of await auditReadRepository.companies()) written += await backfillAuditIndex(id);
  return written;
}

/**
 * Gives every entry older than the oldest index row its index row (title, area, flagged, search text, category, actor, person), using
 * the same wording function the writer uses. Back end A writes the index with each entry, so only entries from before it can lack
 * one. Idempotent and cheap when nothing is missing (one lookup). Reads the append-only table, never changes it.
 */
export async function backfillAuditIndex(companyId: string): Promise<number> {
  let written = 0;
  for (;;) {
    const floor = await auditReadRepository.minIndexedSeq(companyId);
    const entries = await auditReadRepository.entriesBelow(companyId, floor, BATCH);
    if (entries.length === 0) return written;
    await auditReadRepository.insertIndexRows(
      entries.map((e) => {
        const wording = describeEntry({ action: e.action, category: e.category as AuditCategoryCode, reason: e.reason, before: asJson(e.before), after: asJson(e.after) });
        return {
          entryId: e.id,
          companyId: e.companyId,
          siteId: e.siteId,
          seq: e.seq,
          occurredAt: e.occurredAt,
          area: areaOf(e.action),
          flagged: wording.flagged,
          title: wording.title,
          searchText: searchTextOf(wording, e.actorName, e.action),
          category: e.category,
          actorId: e.actorId,
          subjectUserId: e.subjectUserId,
        };
      }),
    );
    written += entries.length;
  }
}
