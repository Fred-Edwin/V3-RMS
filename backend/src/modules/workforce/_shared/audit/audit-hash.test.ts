import { describe, expect, it } from 'vitest';
import { GENESIS_HASH, canonicalEntryJson, hashEntry, verifyAuditChain } from './audit-hash';
import type { AuditEntryRecord } from './audit.types';

const base = {
  companyId: 'c1',
  siteId: 's1',
  occurredAt: new Date('2026-10-06T08:00:00.000Z'),
  action: 'rules.version_created',
  category: 'RULES_OPERATING' as const,
  subjectType: 'RuleVersion',
  subjectId: 'v1',
  actorId: 'u1',
  actorRole: 'DIRECTOR',
  actorName: 'Dir',
  channel: 'APP' as const,
  subjectUserId: null,
  before: { b: 1, a: 2 },
  after: { x: [{ z: 1, y: 2 }] },
  reason: 'why',
  deviceLabel: null,
  placeLabel: null,
};

const chain = (length: number): AuditEntryRecord[] => {
  const entries: AuditEntryRecord[] = [];
  let prevHash = GENESIS_HASH;
  for (let i = 1; i <= length; i += 1) {
    const partial = { ...base, seq: BigInt(i), prevHash, subjectId: `v${i}` };
    const hash = hashEntry(partial);
    entries.push({ ...partial, id: `id${i}`, hash });
    prevHash = hash;
  }
  return entries;
};

describe('canonical form and hash', () => {
  it('ignores key order, at every level', () => {
    const a = canonicalEntryJson({ ...base, seq: 1n, prevHash: GENESIS_HASH });
    const b = canonicalEntryJson({ ...base, before: { a: 2, b: 1 }, after: { x: [{ y: 2, z: 1 }] }, seq: 1n, prevHash: GENESIS_HASH });
    expect(a).toBe(b);
  });

  it('has a fixed known answer (checked with sha256sum)', () => {
    expect(hashEntry({ ...base, seq: 1n, prevHash: GENESIS_HASH })).toBe('75e0bcdd1e96def36b4af998b54a1669c856689f87aaa851fdf368b588793761');
  });

  it('GENESIS_HASH is 64 zeros', () => {
    expect(GENESIS_HASH).toBe('0'.repeat(64));
  });
});

describe('verifyAuditChain', () => {
  it('accepts a good chain', () => {
    const entries = chain(4);
    expect(verifyAuditChain(entries)).toEqual({ ok: true, checked: 4, lastSeq: 4n, lastHash: entries[3]!.hash });
  });

  it('a changed field fails HASH_MISMATCH at that seq', () => {
    const entries = chain(3);
    entries[1] = { ...entries[1]!, reason: 'edited' };
    expect(verifyAuditChain(entries)).toEqual({ ok: false, atSeq: 2n, problem: 'HASH_MISMATCH' });
  });

  it('a removed middle entry fails GAP', () => {
    const entries = chain(3);
    entries.splice(1, 1);
    expect(verifyAuditChain(entries)).toEqual({ ok: false, atSeq: 3n, problem: 'GAP' });
  });

  it('a duplicated seq fails', () => {
    const entries = chain(3);
    entries.splice(2, 0, entries[1]!);
    expect(verifyAuditChain(entries)).toEqual({ ok: false, atSeq: 2n, problem: 'DUPLICATE_SEQ' });
  });

  it('a wrong prevHash fails', () => {
    const entries = chain(3);
    const forged = { ...entries[1]!, prevHash: 'f'.repeat(64) };
    const { id: _id, hash: _hash, ...rest } = forged;
    entries[1] = { ...forged, hash: hashEntry(rest) }; // internally consistent, but not linked to entry 1
    expect(verifyAuditChain(entries)).toEqual({ ok: false, atSeq: 2n, problem: 'PREV_HASH_MISMATCH' });
  });

  it('checks a slice of the chain from a known start', () => {
    const entries = chain(5);
    const slice = entries.slice(2);
    expect(verifyAuditChain(slice, { seq: 2n, hash: entries[1]!.hash })).toMatchObject({ ok: true, checked: 3, lastSeq: 5n });
    expect(verifyAuditChain(slice)).toMatchObject({ ok: false, problem: 'GAP' });
  });

  it('an empty chain is fine', () => {
    expect(verifyAuditChain([])).toEqual({ ok: true, checked: 0, lastSeq: 0n, lastHash: GENESIS_HASH });
  });
});
