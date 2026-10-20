/**
 * THE door of the Workforce audit read side (Segment 6b, 6a spec A1 to A9). Other modules and the worker call:
 *   workforceAuditRouter        mounted once in routes/index.ts
 *   runNightlyChainCheck()      02:00 Nairobi: the last two days, the whole chain on Sundays (src/jobs)
 *   backfillAuditIndex(company) index rows for entries older than the index (nightly and at deploy)
 * The writer, the wording and the hash stay in `_shared/audit/`; this folder only reads.
 */
export { default as workforceAuditRouter } from './audit-routes';
export { runNightlyChainCheck, verifyRange, type NightlyResult } from './chain-service';
export { backfillAuditIndex, backfillAllAuditIndexes } from './index-backfill';
