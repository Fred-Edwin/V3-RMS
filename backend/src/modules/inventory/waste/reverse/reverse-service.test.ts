import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { wasteEntrySchema } from '../_shared/waste-contract';
import { reverseRepository } from './reverse-repository';
import { reverseService } from './reverse-service';

vi.mock('../../../../config/database', () => ({ prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) } }));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../stock/ledger/ledger-door', () => ({ postStockMovement: vi.fn() }));
vi.mock('./reverse-repository', () => ({
  reverseRepository: { findLog: vi.fn(), lockLog: vi.fn(), findWasteLedgerRow: vi.fn(), stampReversal: vi.fn() },
}));

const HUB = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-13T11:20:00Z'); // 14:20 Nairobi
const ENTRY = 'd0000000-0000-4000-8000-000000000001';
const ITEM = '10000000-0000-4000-8000-000000000060';

const attendant = { id: 'u-peter', role: 'STORE_ATTENDANT' as const, siteId: HUB, name: 'Peter' };
const manager = { id: 'u-sam', role: 'STORE_MANAGER' as const, siteId: HUB, name: 'Sam' };
const branchManager = { id: 'u-bm', role: 'MANAGER' as const, siteId: '22222222-2222-4222-8222-222222222222', name: 'Bea' };

const log = (over: Record<string, unknown> = {}) =>
  ({
    id: ENTRY,
    siteId: HUB,
    locationId: 'store',
    inventoryItemId: ITEM,
    quantity: new Prisma.Decimal(3),
    reason: 'EXPIRY',
    note: null,
    unitCost: new Prisma.Decimal(420),
    loggedById: 'u-peter',
    createdAt: new Date('2026-10-13T06:05:00Z'),
    batchId: 'b1',
    reversedAt: null,
    reversedById: null,
    reversalReason: null,
    reversalNote: null,
    inventoryItem: { id: ITEM, name: 'Marinated chicken', usageUnit: 'kg' },
    loggedBy: { id: 'u-peter', name: 'Peter Kariuki', role: 'STORE_ATTENDANT' },
    reversedBy: null,
    ...over,
  }) as never;

const stamped = (by: { id: string; name: string; role: string }, reason: string, note: string | null) =>
  log({ reversedAt: NOW, reversedById: by.id, reversalReason: reason, reversalNote: note, reversedBy: by });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(reverseRepository.findLog).mockResolvedValue(log());
  vi.mocked(reverseRepository.findWasteLedgerRow).mockResolvedValue({
    id: 'tx-1',
    locationId: 'store',
    inventoryItemId: ITEM,
    quantity: new Prisma.Decimal(-3),
    unitCost: new Prisma.Decimal(420),
  });
  vi.mocked(reverseRepository.stampReversal).mockImplementation(async (_tx, _site, _id, data) =>
    stamped({ id: data.reversedById, name: 'Peter Kariuki', role: 'STORE_ATTENDANT' }, data.reversalReason, data.reversalNote),
  );
});

describe('reverseService.reverse (W4)', () => {
  it('posts one WASTE row through the door that undoes the original, with the same positive quantity, and stamps the log', async () => {
    const entry = await reverseService.reverse(attendant, ENTRY, { reason: 'WRONG_QUANTITY' }, NOW);
    expect(postStockMovement).toHaveBeenCalledTimes(1);
    expect(vi.mocked(postStockMovement).mock.calls[0]![1]).toMatchObject({
      type: 'WASTE',
      quantity: new Prisma.Decimal(3),
      unitCost: new Prisma.Decimal(420),
      userId: 'u-peter',
      links: { wasteLogId: ENTRY },
      reversesTransactionId: 'tx-1',
    });
    expect(reverseRepository.lockLog).toHaveBeenCalledWith(expect.anything(), HUB, ENTRY);
    expect(reverseRepository.stampReversal).toHaveBeenCalledWith(expect.anything(), HUB, ENTRY, {
      reversedAt: NOW,
      reversedById: 'u-peter',
      reversalReason: 'WRONG_QUANTITY',
      reversalNote: null,
    });
    expect(() => wasteEntrySchema.parse(entry)).not.toThrow();
    expect(entry).toMatchObject({ status: 'REVERSED', valueKes: '0.00', can: { reverse: false }, reversal: { reason: 'WRONG_QUANTITY' } });
  });

  it('keeps the note when there is one', async () => {
    await reverseService.reverse(manager, ENTRY, { reason: 'OTHER', note: 'Counted twice by mistake' }, NOW);
    expect(vi.mocked(reverseRepository.stampReversal).mock.calls[0]![3]).toMatchObject({ reversalReason: 'OTHER', reversalNote: 'Counted twice by mistake' });
  });

  it('lets the Manager reverse someone else’s entry from an earlier day', async () => {
    vi.mocked(reverseRepository.findLog).mockResolvedValue(log({ createdAt: new Date('2026-10-02T08:00:00Z') }));
    await expect(reverseService.reverse(manager, ENTRY, { reason: 'WRONG_ITEM' }, NOW)).resolves.toBeDefined();
    expect(postStockMovement).toHaveBeenCalledTimes(1);
  });

  it('refuses the Attendant someone else’s entry with NOT_YOUR_ENTRY (403) and writes nothing', async () => {
    vi.mocked(reverseRepository.findLog).mockResolvedValue(log({ loggedById: 'u-other' }));
    await expect(reverseService.reverse(attendant, ENTRY, { reason: 'WRONG_ITEM' }, NOW)).rejects.toMatchObject({ statusCode: 403, code: 'NOT_YOUR_ENTRY' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('refuses the Attendant yesterday’s entry with REVERSAL_WINDOW_PASSED (403)', async () => {
    vi.mocked(reverseRepository.findLog).mockResolvedValue(log({ createdAt: new Date('2026-10-12T08:00:00Z') }));
    await expect(reverseService.reverse(attendant, ENTRY, { reason: 'WRONG_ITEM' }, NOW)).rejects.toMatchObject({ statusCode: 403, code: 'REVERSAL_WINDOW_PASSED' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('answers a repeat with ALREADY_REVERSED (409), for the Manager too', async () => {
    vi.mocked(reverseRepository.findLog).mockResolvedValue(log({ reversedAt: new Date('2026-10-13T06:12:00Z') }));
    await expect(reverseService.reverse(manager, ENTRY, { reason: 'WRONG_ITEM' }, NOW)).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_REVERSED' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('checks again under the lock: a racer that reversed it first makes this one ALREADY_REVERSED', async () => {
    vi.mocked(reverseRepository.findLog)
      .mockResolvedValueOnce(log())
      .mockResolvedValueOnce(log({ reversedAt: new Date('2026-10-13T11:19:59Z') }));
    await expect(reverseService.reverse(attendant, ENTRY, { reason: 'WRONG_ITEM' }, NOW)).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('is 404 for an entry that is not on the hub’s books, and 403 for a caller outside the hub', async () => {
    vi.mocked(reverseRepository.findLog).mockResolvedValue(null);
    await expect(reverseService.reverse(manager, ENTRY, { reason: 'WRONG_ITEM' }, NOW)).rejects.toMatchObject({ statusCode: 404 });
    await expect(reverseService.reverse(branchManager, ENTRY, { reason: 'WRONG_ITEM' }, NOW)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('is 404 when the entry has no ledger row to undo', async () => {
    vi.mocked(reverseRepository.findWasteLedgerRow).mockResolvedValue(null);
    await expect(reverseService.reverse(manager, ENTRY, { reason: 'WRONG_ITEM' }, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(reverseRepository.stampReversal).not.toHaveBeenCalled();
  });
});
