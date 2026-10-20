import { logger } from '../../../utils/logger';
import { documentSources } from '../_shared/documents/document-sources';
import { documentsRepository } from '../_shared/documents/documents-repository';
import { reconcileRepository } from './reconcile-repository';

export interface ReconcileResult {
  registered: number;
  skipped: number;
  failed: number;
}

/**
 * Indexes every already-issued document the read model does not hold yet, and marks voided ones withdrawn. Idempotent: a second run
 * changes nothing. The backfill (deploy and nightly) and the lazy catch-up (a verify miss, an index read) are this one function, and
 * both write through `registerDocument`, so the index has one way in. A document the door refuses is logged by kind and number
 * only and counted as failed; it never stops the rest.
 */
export async function reconcileDocuments(companyId?: string): Promise<ReconcileResult> {
  const result: ReconcileResult = { registered: 0, skipped: 0, failed: 0 };
  const companies = companyId ? [{ id: companyId }] : await reconcileRepository.companies();
  for (const { id } of companies) {
    for (const [kind, source] of documentSources()) {
      let issued;
      try {
        issued = await source(id);
      } catch (error) {
        result.failed += 1;
        logger.error({ err: error, kind }, 'a document source could not be read');
        continue;
      }
      const held = await documentsRepository.numbersHeld(id, kind);
      for (const doc of issued) {
        const alreadyHeld = held.has(`${doc.input.number}#${doc.input.version ?? 1}`);
        if (alreadyHeld && !doc.withdrawn) {
          result.skipped += 1;
          continue;
        }
        try {
          if (await reconcileRepository.registerOne(doc)) result.registered += 1;
          else result.skipped += 1;
        } catch (error) {
          result.failed += 1;
          logger.warn({ err: error, kind, number: doc.input.number }, 'a signed document could not be indexed');
        }
      }
    }
  }
  return result;
}

export const INDEX_READ_FRESH_MS = 5 * 60_000;
export const VERIFY_MISS_FRESH_MS = 60_000;
let lastRun = 0;
let running: Promise<ReconcileResult> | null = null;

/**
 * The catch-up before a read: runs the reconciliation unless one ran within `maxAgeMs` (or is running now, which it joins). The
 * index uses five minutes; a verify miss uses one, so a document printed a moment ago verifies at once, while a flood of unknown
 * numbers costs one scan a minute.
 */
export async function reconcileIfStale(maxAgeMs: number, now: number = Date.now()): Promise<void> {
  if (running) {
    await running.catch(() => undefined);
    return;
  }
  if (now - lastRun < maxAgeMs) return;
  lastRun = now;
  running = reconcileDocuments().finally(() => {
    running = null;
  });
  await running.catch((error: unknown) => logger.error({ err: error }, 'document catch-up failed'));
}

/** Test seam. */
export const resetReconcileClock = (): void => {
  lastRun = 0;
  running = null;
};
