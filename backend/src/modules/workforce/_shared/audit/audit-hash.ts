import { createHash } from 'node:crypto';
import type { JsonValue } from './audit.types';
import type { AuditEntryRecord } from './audit.types';

export const GENESIS_HASH = '0'.repeat(64);

type HashableEntry = Omit<AuditEntryRecord, 'id' | 'hash'>;

const sortKeys = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const sorted: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) sorted[key] = sortKeys(value[key] as JsonValue);
    return sorted;
  }
  return value;
};

/** UTF-8 JSON, keys sorted at every level, occurredAt as ISO with milliseconds, seq as a decimal string, absent values as null. */
export function canonicalEntryJson(entry: HashableEntry): string {
  const canonical: { [key: string]: JsonValue } = {
    action: entry.action,
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    after: sortKeys(entry.after ?? null),
    before: sortKeys(entry.before ?? null),
    category: entry.category,
    channel: entry.channel,
    companyId: entry.companyId,
    deviceLabel: entry.deviceLabel ?? null,
    occurredAt: entry.occurredAt.toISOString(),
    placeLabel: entry.placeLabel ?? null,
    prevHash: entry.prevHash,
    reason: entry.reason ?? null,
    seq: entry.seq.toString(),
    siteId: entry.siteId ?? null,
    subjectId: entry.subjectId,
    subjectType: entry.subjectType,
    subjectUserId: entry.subjectUserId ?? null,
  };
  return JSON.stringify(canonical);
}

export function hashEntry(entry: HashableEntry): string {
  return createHash('sha256').update(canonicalEntryJson(entry), 'utf8').digest('hex');
}

export type ChainVerdict =
  | { ok: true; checked: number; lastSeq: bigint; lastHash: string }
  | { ok: false; atSeq: bigint; problem: 'HASH_MISMATCH' | 'PREV_HASH_MISMATCH' | 'GAP' | 'DUPLICATE_SEQ' };

/** Entries must be in seq order for one company. `start` is the previous entry's seq and hash when checking a slice of the chain. */
export function verifyAuditChain(entries: readonly AuditEntryRecord[], start?: { seq: bigint; hash: string }): ChainVerdict {
  let lastSeq = start?.seq ?? 0n;
  let lastHash = start?.hash ?? GENESIS_HASH;
  let checked = 0;
  for (const entry of entries) {
    if (entry.seq === lastSeq && checked > 0) return { ok: false, atSeq: entry.seq, problem: 'DUPLICATE_SEQ' };
    if (entry.seq !== lastSeq + 1n) return { ok: false, atSeq: entry.seq, problem: 'GAP' };
    if (entry.prevHash !== lastHash) return { ok: false, atSeq: entry.seq, problem: 'PREV_HASH_MISMATCH' };
    const { id: _id, hash: _hash, ...rest } = entry;
    if (hashEntry(rest) !== entry.hash) return { ok: false, atSeq: entry.seq, problem: 'HASH_MISMATCH' };
    lastSeq = entry.seq;
    lastHash = entry.hash;
    checked += 1;
  }
  return { ok: true, checked, lastSeq, lastHash };
}
