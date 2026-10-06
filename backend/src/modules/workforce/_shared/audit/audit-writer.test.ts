import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEntryRecord } from './audit.types';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  ensureHead: vi.fn(),
  lockChainHead: vi.fn(),
  insertEntry: vi.fn(),
  advanceHead: vi.fn(),
}));

vi.mock('../../../../config/database', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('./audit-repository', () => ({
  auditRepository: { ensureHead: mocks.ensureHead, lockChainHead: mocks.lockChainHead, insertEntry: mocks.insertEntry, advanceHead: mocks.advanceHead },
}));

import { GENESIS_HASH } from './audit-hash';
import { runAudited, writeAuditEntry } from './audit-writer';
import { workforceEvents, type WorkforceEvent } from '../events';

const TX = { tx: true } as never;
const entry = (over: Record<string, unknown> = {}) => ({
  companyId: 'c1',
  siteId: 's1',
  actor: { id: 'u1', role: 'DIRECTOR', name: 'Dir A' },
  action: 'rules.version_created',
  category: 'RULES_OPERATING' as const,
  subjectType: 'RuleVersion',
  subjectId: 'v1',
  after: { graceMinutes: 5 },
  reason: 'why',
  ...over,
});
const rulesEvent = (): WorkforceEvent => ({
  name: 'rules.version_confirmed',
  occurredAt: '2026-10-06T08:00:00.000Z',
  payload: { versionId: 'v1', group: 'LATENESS', scope: 's', confirmedById: 'u1' },
});

/** An in-memory chain head so seq and hashes behave like the real thing. */
let head = { lastSeq: 0n, lastHash: GENESIS_HASH };
const rows: AuditEntryRecord[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  head = { lastSeq: 0n, lastHash: GENESIS_HASH };
  rows.length = 0;
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(TX));
  mocks.lockChainHead.mockImplementation(async () => head);
  mocks.insertEntry.mockImplementation(async (_tx: unknown, row: Omit<AuditEntryRecord, 'id'>) => {
    const record = { ...row, id: `id${rows.length + 1}` };
    rows.push(record);
    return record;
  });
  mocks.advanceHead.mockImplementation(async (_tx: unknown, _company: string, seq: bigint, hash: string) => {
    head = { lastSeq: seq, lastHash: hash };
  });
});

describe('writeAuditEntry', () => {
  it('the first entry uses GENESIS_HASH and seq 1; the next links to it with seq 2', async () => {
    const first = await writeAuditEntry(TX, entry());
    const second = await writeAuditEntry(TX, entry({ subjectId: 'v2' }));
    expect(first).toMatchObject({ seq: 1n, prevHash: GENESIS_HASH });
    expect(second).toMatchObject({ seq: 2n, prevHash: first.hash });
    expect(second.hash).not.toBe(first.hash);
  });

  it('locks the head before it reads the sequence, and advances it after the insert', async () => {
    await writeAuditEntry(TX, entry());
    const order = [mocks.ensureHead, mocks.lockChainHead, mocks.insertEntry, mocks.advanceHead].map((m) => m.mock.invocationCallOrder[0]!);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(mocks.advanceHead).toHaveBeenCalledWith(TX, 'c1', 1n, rows[0]!.hash);
  });

  it('keeps the actor name as a snapshot', async () => {
    const record = await writeAuditEntry(TX, entry({ actor: { id: 'u1', role: 'DIRECTOR', name: 'Old Name' } }));
    expect(record.actorName).toBe('Old Name');
  });

  it('defaults the channel to APP and allows SYSTEM with no actor id', async () => {
    expect((await writeAuditEntry(TX, entry())).channel).toBe('APP');
    expect(await writeAuditEntry(TX, entry({ channel: 'SYSTEM', actor: { id: null, role: 'SYSTEM', name: 'System' } }))).toMatchObject({ channel: 'SYSTEM', actorId: null });
  });
});

describe('runAudited', () => {
  it('a successful change writes exactly one entry and emits its event after commit', async () => {
    const received: string[] = [];
    const off = workforceEvents.on('rules.version_confirmed', (event) => {
      received.push(`${event.name}:${mocks.insertEntry.mock.calls.length}`);
    });
    const result = await runAudited(async () => ({ result: 'done', entries: [entry()], events: [rulesEvent()] }));
    off();
    expect(result).toBe('done');
    expect(mocks.insertEntry).toHaveBeenCalledTimes(1);
    expect(received).toEqual(['rules.version_confirmed:1']);
  });

  it('a change that throws writes no entry and emits no event', async () => {
    const handler = vi.fn();
    const off = workforceEvents.on('rules.version_confirmed', handler);
    await expect(
      runAudited(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    off();
    expect(mocks.insertEntry).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('an entry that cannot be written fails the whole change and emits nothing', async () => {
    const handler = vi.fn();
    const off = workforceEvents.on('rules.version_confirmed', handler);
    mocks.insertEntry.mockRejectedValueOnce(new Error('disk full'));
    await expect(runAudited(async () => ({ result: 1, entries: [entry()], events: [rulesEvent()] }))).rejects.toThrow('disk full');
    off();
    expect(handler).not.toHaveBeenCalled();
  });

  it('an unregistered action fails the change', async () => {
    await expect(runAudited(async () => ({ result: 1, entries: [entry({ action: 'nope' })] }))).rejects.toMatchObject({ code: 'AUDIT_ACTION_UNREGISTERED' });
  });

  it('a bulk action writes one entry for the batch', async () => {
    await runAudited(async () => ({ result: 1, entries: [entry({ subjectType: 'RuleVersionBatch', after: { ids: ['a', 'b', 'c'] } })] }));
    expect(mocks.insertEntry).toHaveBeenCalledTimes(1);
  });

  it('a failing listener does not undo a committed change', async () => {
    const off = workforceEvents.on('rules.version_confirmed', () => {
      throw new Error('listener bug');
    });
    await expect(runAudited(async () => ({ result: 'ok', entries: [entry()], events: [rulesEvent()] }))).resolves.toBe('ok');
    off();
  });
});

describe('static rules', () => {
  const dir = __dirname;
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));

  it('nothing updates, deletes or upserts an audit entry', () => {
    const offenders = sources.filter(({ text }) => /auditEntry\.(update|updateMany|delete|deleteMany|upsert)\b/.test(text)).map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it('the writer has no overload that opens its own transaction (the tx is a required first argument)', () => {
    expect(readFileSync(join(dir, 'audit-writer.ts'), 'utf8')).toMatch(/export async function writeAuditEntry\(tx: Prisma\.TransactionClient,/);
  });
});
