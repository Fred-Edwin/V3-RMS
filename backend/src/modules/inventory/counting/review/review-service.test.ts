import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { readCountDetail } from '../_shared/count-detail-reader';
import { countNotify } from '../_shared/count-notify';
import { countPin } from '../_shared/count-pin';
import { countError } from '../_shared/count-errors';
import { D, count, frozen, hubId, itemIdOf, lineIdOf, signedLine } from '../_shared/count-fixtures';
import { buildApprovePreview } from './review-preview';
import { reviewRepository } from './review-repository';
import { reviewService } from './review-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({ marker: 'tx' }) } }));
vi.mock('../../stock/ledger/ledger-door', () => ({ postStockMovement: vi.fn() }));
vi.mock('../_shared/count-detail-reader', () => ({ readCountDetail: vi.fn() }));
vi.mock('../_shared/count-notify', () => ({ countNotify: { directorAlert: vi.fn() } }));
vi.mock('../_shared/count-pin', () => ({ countPin: { verifyOwn: vi.fn() } }));
vi.mock('./review-repository', () => ({
  reviewRepository: { findById: vi.fn(), lockCount: vi.fn(), decideLines: vi.fn(), flagForDirector: vi.fn(), markApproved: vi.fn(), markSeen: vi.fn() },
}));

const manager = { id: 'u-isabel', role: 'STORE_MANAGER', siteId: hubId } as never;
const branchManager = { id: 'bm', role: 'MANAGER', siteId: 'b1' } as never;
const now = new Date('2026-10-13T09:00:00Z');
const TX = { marker: 'tx' };
const detail = { id: 'detail' } as never;

// Sugar outside (-16 at 183 = -2928), Rice within (-1 at 100 = -100), Oil matches, Tea not counted, Eggs outside (-5 at 520 = -2600).
const lines = () => [
  signedLine(1, 164, 180, 'EXCEEDS', { name: 'Sugar, white', currentCost: 183 }),
  signedLine(2, 99, 100, 'WITHIN_RANGE', { name: 'Rice' }),
  signedLine(3, 40, 40, 'MATCHES', { name: 'Oil' }),
  signedLine(4, null, 7, 'NOT_COUNTED', { name: 'Tea' }),
  signedLine(5, 0, 5, 'EXCEEDS', { name: 'Eggs', currentCost: 520 }),
];
const submitted = (over = {}, ls = lines()) => count(ls, { status: 'SUBMITTED', signedAt: now, ...frozen, ...over });
const decided = () => {
  const ls = lines();
  ls[0] = { ...ls[0]!, decision: 'WRITE_OFF', cause: 'PREP_NOT_LOGGED' };
  ls[1] = { ...ls[1]!, decision: 'ACCEPTED' };
  ls[4] = { ...ls[4]!, decision: 'MOVEMENT_LOGGED', movementKind: 'DISPATCH' };
  return ls;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubId } as never);
  vi.mocked(readCountDetail).mockResolvedValue(detail);
  vi.mocked(reviewRepository.findById).mockResolvedValue(submitted());
  vi.mocked(countPin.verifyOwn).mockResolvedValue({ id: 'u-isabel', name: 'Isabel Njoki', role: 'STORE_MANAGER', pinHash: 'h' });
});

describe('C27 decide', () => {
  const decide = (input: object) => reviewService.decide(manager, 'c', input as never, now);

  it('a cause for several outside-range lines at once, under the count lock, stamped with who and when', async () => {
    await decide({ lineIds: [lineIdOf(1), lineIdOf(5)], decision: { kind: 'WRITE_OFF', cause: 'MISCOUNT' } });
    expect(reviewRepository.lockCount).toHaveBeenCalledWith(TX, hubId, 'c');
    expect(reviewRepository.decideLines).toHaveBeenCalledWith(TX, hubId, 'c', [lineIdOf(1), lineIdOf(5)], { decision: 'WRITE_OFF', cause: 'MISCOUNT', causeNote: null, decidedById: 'u-isabel', decidedAt: now });
  });

  it('"Other" keeps its note, trimmed', async () => {
    await decide({ lineIds: [lineIdOf(1)], decision: { kind: 'WRITE_OFF', cause: 'OTHER', note: ' Dropped crate ' } });
    expect(vi.mocked(reviewRepository.decideLines).mock.calls[0]![4]).toMatchObject({ cause: 'OTHER', causeNote: 'Dropped crate' });
  });

  it('a logged movement and a recount request only say what was decided: no ledger write', async () => {
    await decide({ lineIds: [lineIdOf(1)], decision: { kind: 'MOVEMENT_LOGGED', movementKind: 'PREP_USE' } });
    await decide({ lineIds: [lineIdOf(5)], decision: { kind: 'RECOUNT_ASKED' } });
    expect(vi.mocked(reviewRepository.decideLines).mock.calls.map((c) => c[4])).toEqual([
      { decision: 'MOVEMENT_LOGGED', movementKind: 'PREP_USE', decidedById: 'u-isabel', decidedAt: now },
      { decision: 'RECOUNT_ASKED', decidedById: 'u-isabel', decidedAt: now },
    ]);
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('"Accept all within range" takes every undecided within-range line; a second tap does nothing', async () => {
    await decide({ group: 'WITHIN_RANGE', decision: { kind: 'ACCEPTED' } });
    expect(reviewRepository.decideLines).toHaveBeenCalledWith(TX, hubId, 'c', [lineIdOf(2)], expect.objectContaining({ decision: 'ACCEPTED' }));
    vi.mocked(reviewRepository.decideLines).mockClear();
    const done = lines();
    done[1] = { ...done[1]!, decision: 'ACCEPTED' };
    vi.mocked(reviewRepository.findById).mockResolvedValue(submitted({}, done));
    await decide({ group: 'WITHIN_RANGE', decision: { kind: 'ACCEPTED' } });
    expect(reviewRepository.decideLines).not.toHaveBeenCalled();
  });

  it('CLEAR takes a decision back to pending', async () => {
    await decide({ lineIds: [lineIdOf(1)], decision: { kind: 'CLEAR' } });
    expect(reviewRepository.decideLines).toHaveBeenCalledWith(TX, hubId, 'c', [lineIdOf(1)], { decision: 'PENDING' });
  });

  it('refuses the wrong decision for a line: accepting an outside-range one, writing off a within-range one, deciding matched or skipped lines', async () => {
    await expect(decide({ lineIds: [lineIdOf(1)], decision: { kind: 'ACCEPTED' } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(decide({ lineIds: [lineIdOf(2)], decision: { kind: 'WRITE_OFF', cause: 'LOSS' } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(decide({ lineIds: [lineIdOf(3)], decision: { kind: 'RECOUNT_ASKED' } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(decide({ lineIds: [lineIdOf(4)], decision: { kind: 'CLEAR' } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(decide({ lineIds: ['not-here'], decision: { kind: 'RECOUNT_ASKED' } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(decide({ group: 'WITHIN_RANGE', decision: { kind: 'WRITE_OFF', cause: 'LOSS' } })).rejects.toMatchObject({ statusCode: 400 });
    expect(reviewRepository.decideLines).not.toHaveBeenCalled();
  });

  it('a good line and a bad one together: nothing is decided', async () => {
    await expect(decide({ lineIds: [lineIdOf(1), lineIdOf(2)], decision: { kind: 'WRITE_OFF', cause: 'LOSS' } })).rejects.toMatchObject({ statusCode: 400 });
    expect(reviewRepository.decideLines).not.toHaveBeenCalled();
  });

  it('COUNT_NOT_SUBMITTED for an open or an approved count', async () => {
    for (const status of ['OPEN', 'APPROVED'] as const) {
      vi.mocked(reviewRepository.findById).mockResolvedValue(submitted({ status }));
      await expect(decide({ lineIds: [lineIdOf(1)], decision: { kind: 'RECOUNT_ASKED' } })).rejects.toMatchObject({ statusCode: 409, code: 'COUNT_NOT_SUBMITTED' });
    }
  });

  it('404 for a count that does not exist; 403 for a caller who is not at the hub', async () => {
    vi.mocked(reviewRepository.findById).mockResolvedValue(null);
    await expect(decide({ group: 'WITHIN_RANGE', decision: { kind: 'ACCEPTED' } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(reviewService.decide(branchManager, 'c', {} as never, now)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('C28 approve preview', () => {
  it('lists the adjustments that will post, the accepted group, the net, the Director note and the not-counted note', () => {
    const preview = buildApprovePreview(submitted({}, decided()));
    expect(preview).toEqual({
      rows: [{ lineId: lineIdOf(1), label: 'Sugar, white · Prep use not logged', valueKes: '-2928.00' }],
      withinRange: { count: 1, netKes: '-100.00' },
      adjustments: 2,
      netKes: '-3028.00',
      directorNote: 'Director is not alerted. No single difference reaches KES 5,000.',
      notCountedNote: 'Tea was not counted, so nothing is written for it.',
    });
  });

  it('a logged movement and a recount request are not in it, and a line at the alert amount says the Director is alerted', () => {
    const ls = decided();
    ls[4] = { ...ls[4]!, decision: 'RECOUNT_ASKED', movementKind: null };
    const preview = buildApprovePreview(submitted({ directorAlertKes: 2600 }, ls));
    expect(preview.rows.map((r) => r.lineId)).toEqual([lineIdOf(1)]);
    expect(preview.directorNote).toBe('Director is alerted. 2 lines reach KES 2,600.');
  });

  it('is served for a SUBMITTED count only', async () => {
    expect(await reviewService.approvePreview(manager, 'c')).toMatchObject({ adjustments: 0 });
    vi.mocked(reviewRepository.findById).mockResolvedValue(submitted({ status: 'APPROVED' }));
    await expect(reviewService.approvePreview(manager, 'c')).rejects.toMatchObject({ code: 'COUNT_NOT_SUBMITTED' });
  });
});

describe('C29 approve', () => {
  const approve = (over = {}) => reviewService.approve(manager, 'c', { pin: '1234', idempotencyKey: 'approve-key-3', ...over }, now);
  const signedKey = 'start-key-1|sign-key-2';

  beforeEach(() => {
    vi.mocked(reviewRepository.findById).mockResolvedValue(submitted({ idempotencyKey: signedKey }, decided()));
  });

  it('posts one ADJUSTMENT per non-zero written-off or accepted line, through the door, linked to its line, signed by the approver', async () => {
    const out = await approve();
    expect(out).toEqual({ detail, replayed: false });
    expect(vi.mocked(postStockMovement).mock.calls.map(([tx, i]) => [tx, i.type, i.inventoryItemId, i.quantity.toString(), i.unitCost.toString(), i.reason, i.userId, i.links])).toEqual([
      [TX, 'ADJUSTMENT', itemIdOf(1), '-16', '183', 'Prep use not logged', 'u-isabel', { countLineId: lineIdOf(1) }],
      [TX, 'ADJUSTMENT', itemIdOf(2), '-1', '100', 'Within range · accepted', 'u-isabel', { countLineId: lineIdOf(2) }],
    ]);
  });

  it('writes nothing for matched, skipped, logged-movement and recount-asked lines', async () => {
    await approve();
    const items = vi.mocked(postStockMovement).mock.calls.map(([, i]) => i.inventoryItemId);
    for (const n of [3, 4, 5]) expect(items).not.toContain(itemIdOf(n));
  });

  it('marks it approved with the approver, time and the third key, keeping the first two', async () => {
    await approve();
    expect(reviewRepository.markApproved).toHaveBeenCalledWith(TX, expect.any(String), expect.objectContaining({ approverId: 'u-isabel', approvedAt: now, idempotencyKey: 'start-key-1|sign-key-2|approve-key-3' }));
    expect(reviewRepository.lockCount).toHaveBeenCalledWith(TX, hubId, 'c');
  });

  it('flags and alerts only the lines at or above the alert amount, after the commit', async () => {
    await approve();
    expect(reviewRepository.flagForDirector).toHaveBeenCalledWith(TX, hubId, 'c', []);
    expect(countNotify.directorAlert).toHaveBeenCalledWith(expect.objectContaining({ signerName: 'Isabel Njoki', lines: [] }), now);

    vi.mocked(reviewRepository.findById).mockResolvedValue(submitted({ idempotencyKey: signedKey, directorAlertKes: 2900 }, decided()));
    await approve();
    expect(reviewRepository.flagForDirector).toHaveBeenLastCalledWith(TX, hubId, 'c', [lineIdOf(1)]);
    expect(countNotify.directorAlert).toHaveBeenLastCalledWith(expect.objectContaining({ lines: [{ itemName: 'Sugar, white', valueKes: -2928 }] }), now);
  });

  it('LINES_UNDECIDED (with the lines) while an outside-range line has no decision; nothing is posted and the PIN is not even asked', async () => {
    vi.mocked(reviewRepository.findById).mockResolvedValue(submitted({ idempotencyKey: signedKey }));
    await expect(approve()).rejects.toMatchObject({ statusCode: 422, code: 'LINES_UNDECIDED', details: { lineIds: [lineIdOf(1), lineIdOf(5)] } });
    expect(countPin.verifyOwn).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('INVALID_PIN writes nothing', async () => {
    vi.mocked(countPin.verifyOwn).mockRejectedValue(countError('INVALID_PIN', 'That PIN is not right.'));
    await expect(approve()).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_PIN' });
    expect(reviewRepository.lockCount).not.toHaveBeenCalled();
    expect(postStockMovement).not.toHaveBeenCalled();
    expect(reviewRepository.markApproved).not.toHaveBeenCalled();
  });

  it('all or none: the door refusing a line stops the approval and the push', async () => {
    vi.mocked(postStockMovement).mockResolvedValueOnce({} as never).mockRejectedValueOnce(new Error('door rejected'));
    await expect(approve()).rejects.toThrow('door rejected');
    expect(reviewRepository.markApproved).not.toHaveBeenCalled();
    expect(countNotify.directorAlert).not.toHaveBeenCalled();
  });

  it('a retried key returns the approved count again and posts nothing; another key is COUNT_NOT_SUBMITTED', async () => {
    vi.mocked(reviewRepository.findById).mockResolvedValue(submitted({ status: 'APPROVED', idempotencyKey: `${signedKey}|approve-key-3` }, decided()));
    expect(await approve()).toEqual({ detail, replayed: true });
    expect(postStockMovement).not.toHaveBeenCalled();
    await expect(approve({ idempotencyKey: 'another-key-9' })).rejects.toMatchObject({ code: 'COUNT_NOT_SUBMITTED' });
  });

  it('two Managers at once: the second finds it approved under the lock and is answered as a replay', async () => {
    vi.mocked(reviewRepository.findById)
      .mockResolvedValueOnce(submitted({ idempotencyKey: signedKey }, decided()))
      .mockResolvedValueOnce(submitted({ status: 'APPROVED', idempotencyKey: `${signedKey}|approve-key-3` }, decided()));
    expect(await approve()).toMatchObject({ replayed: true });
    expect(postStockMovement).not.toHaveBeenCalled();
  });

  it('refuses a caller who is not at the hub', async () => {
    await expect(reviewService.approve(branchManager, 'c', { pin: '1234', idempotencyKey: 'approve-key-3' }, now)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('C30 mark seen', () => {
  it('marks the flagged, unseen lines for the caller and reports how many', async () => {
    vi.mocked(reviewRepository.markSeen).mockResolvedValue(2);
    expect(await reviewService.markSeen({ id: 'u-grace', role: 'DIRECTOR', siteId: hubId } as never, { lineIds: [lineIdOf(1), lineIdOf(1), lineIdOf(5)] }, now)).toEqual({ seen: 2 });
    expect(reviewRepository.markSeen).toHaveBeenCalledWith(hubId, [lineIdOf(1), lineIdOf(5)], 'u-grace', now);
  });

  it('lines that are not flagged are simply not counted', async () => {
    vi.mocked(reviewRepository.markSeen).mockResolvedValue(0);
    expect(await reviewService.markSeen({ id: 'u-grace', role: 'DIRECTOR', siteId: hubId } as never, { lineIds: [lineIdOf(2)] }, now)).toEqual({ seen: 0 });
  });
});

void D;
