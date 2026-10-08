import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { settingsInForce } from '../_shared/count-settings';
import { D, itemIdOf, line, lineIdOf } from '../_shared/count-fixtures';
import { adjustmentReason } from '../_shared/count-reason';
import { applySave, orderedSections, planFreeze, type FreezeMode } from './record-logic';
import type { SectionRow } from './record-repository';

const section = (id: string, position: number): SectionRow => ({ id, name: id.toUpperCase(), kind: 'MANUAL', supplierId: null, supplierName: null, position, itemCount: 1 });
const shelf = [section('a', 0), section('b', 1), section('c', 2), section('d', 3)];

describe('orderedSections (C8)', () => {
  it('the Manager’s shelf order when this person has set none', () => {
    expect(orderedSections(shelf, null).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(orderedSections(shelf, []).map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('their own order for today first, the rest in shelf order', () => {
    expect(orderedSections(shelf, ['c', 'a']).map((s) => s.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('a section that no longer exists is ignored, and a new one is appended', () => {
    expect(orderedSections(shelf, ['gone', 'd', 'b']).map((s) => s.id)).toEqual(['d', 'b', 'a', 'c']);
  });
});

describe('applySave (C10): last write wins', () => {
  const fresh = line(1);
  const counted = line(1, { countedQty: D(3) });
  const skipped = line(1, { skipped: true });

  it('typing a number clears Skip', () => {
    expect(applySave(skipped, { countedQty: '4', skipped: false })).toEqual({ countedQty: D(4), skipped: false });
  });

  it('a zero is a real count', () => {
    expect(applySave(fresh, { countedQty: '0', skipped: false })).toEqual({ countedQty: D(0), skipped: false });
  });

  it('Skip clears the number', () => {
    expect(applySave(counted, { countedQty: null, skipped: true })).toEqual({ countedQty: null, skipped: true });
  });

  it('a number sent with Skip wins (Skip is ignored)', () => {
    expect(applySave(fresh, { countedQty: '2', skipped: true })).toEqual({ countedQty: D(2), skipped: false });
  });

  it('neither a number nor Skip puts the line back to untouched', () => {
    expect(applySave(counted, { countedQty: null, skipped: false })).toEqual({ countedQty: null, skipped: false });
  });

  it('a decimal number keeps its places', () => {
    expect(applySave(fresh, { countedQty: '2.375', skipped: false }).countedQty?.toString()).toBe('2.375');
  });

  describe('the section-end recheck', () => {
    const offered = line(1, { countedQty: D(162), recheckOffered: true });

    it('RECOUNTED stores the new number and keeps the first one', () => {
      expect(applySave(offered, { countedQty: '164', skipped: false, recheck: 'RECOUNTED' })).toEqual({ countedQty: D(164), skipped: false, recheck: 'RECOUNTED', firstCountedQty: D(162) });
    });

    it('KEPT ("Continue as counted") leaves the number as it was', () => {
      expect(applySave(offered, { countedQty: null, skipped: false, recheck: 'KEPT' })).toEqual({ countedQty: D(162), skipped: false, recheck: 'KEPT' });
    });

    it('a recount without a number is refused', () => {
      expect(() => applySave(offered, { countedQty: null, skipped: false, recheck: 'RECOUNTED' })).toThrowError(expect.objectContaining({ statusCode: 400 }));
    });

    it('a line that was never offered cannot be rechecked', () => {
      expect(() => applySave(counted, { countedQty: '5', skipped: false, recheck: 'RECOUNTED' })).toThrowError(expect.objectContaining({ statusCode: 400 }));
    });

    it('a line already answered cannot be rechecked a second time', () => {
      const answered = line(1, { countedQty: D(164), recheckOffered: true, recheck: 'RECOUNTED', firstCountedQty: D(162) });
      expect(() => applySave(answered, { countedQty: '170', skipped: false, recheck: 'RECOUNTED' })).toThrowError(expect.objectContaining({ statusCode: 400 }));
    });

    it('but the number of an answered line can still be changed on the review screen (no recheck flag)', () => {
      const answered = line(1, { countedQty: D(164), recheckOffered: true, recheck: 'RECOUNTED', firstCountedQty: D(162) });
      expect(applySave(answered, { countedQty: '165', skipped: false })).toEqual({ countedQty: D(165), skipped: false });
    });
  });
});

describe('planFreeze (C13): the moment figures are frozen', () => {
  const settings = settingsInForce(null); // KES 500, 5 %, repeat on, alert KES 5,000
  const signedAt = new Date('2026-10-13T04:42:00Z');
  const none = new Map<string, readonly Prisma.Decimal[]>();

  // Sugar 164 of 180 at KES 183 (8.9 %, KES 2,928: outside); Rice 99 of 100 at KES 100 (1 %, KES 100: within); Oil 40 of 40 (matches);
  // Tea skipped; Eggs counted 0 of 5 at KES 520 (outside, KES 2,600).
  const lines = [
    line(1, { name: 'Sugar, white', currentCost: 183, countedQty: D(164) }),
    line(2, { name: 'Rice', currentCost: 100, countedQty: D(99) }),
    line(3, { name: 'Oil', currentCost: 100, countedQty: D(40) }),
    line(4, { name: 'Tea', currentCost: 100, skipped: true }),
    line(5, { name: 'Eggs', currentCost: 520, countedQty: D(0) }),
  ];
  const onHand = new Map([[itemIdOf(1), D(180)], [itemIdOf(2), D(100)], [itemIdOf(3), D(40)], [itemIdOf(4), D(7)], [itemIdOf(5), D(5)]]);
  const plan = (mode: FreezeMode, over: Partial<Parameters<typeof planFreeze>[0]> = {}) => planFreeze({ lines, onHand, settings, recentDifferences: none, mode, signedAt, ...over });

  describe('an Attendant signs (SUBMIT)', () => {
    const { plans, missingCauses } = plan({ kind: 'SUBMIT' });
    const byName = new Map(plans.map((p) => [p.itemName, p]));

    it('freezes expected stock, cost and the result of every line', () => {
      expect([...byName].map(([name, p]) => [name, p.freeze.expectedQty.toString(), p.freeze.unitCost.toString(), p.freeze.result])).toEqual([
        ['Sugar, white', '180', '183', 'EXCEEDS'],
        ['Rice', '100', '100', 'WITHIN_RANGE'],
        ['Oil', '40', '100', 'MATCHES'],
        ['Tea', '7', '100', 'NOT_COUNTED'],
        ['Eggs', '5', '520', 'EXCEEDS'],
      ]);
    });

    it('decides nothing, posts nothing, flags nothing and alerts nobody (that happens when the Manager approves)', () => {
      expect(missingCauses).toEqual([]);
      for (const p of plans) {
        expect(p.post).toBeNull();
        expect(p.flagged).toBe(false);
        expect(p.alertValueKes).toBeNull();
        expect(p.freeze.decision).toBeUndefined();
        expect(p.freeze.directorFlagged).toBeUndefined();
      }
    });
  });

  describe('the repeat-shortfall streak', () => {
    it('counts this count and the short counts before it', () => {
      const recent = new Map([[itemIdOf(1), [D(-2), D(-1), D(3)]]]);
      const sugar = plan({ kind: 'SUBMIT' }, { recentDifferences: recent }).plans.find((p) => p.itemName === 'Sugar, white')!;
      expect(sugar.freeze.shortStreak).toBe(3);
    });

    it('stops at a count that was not short', () => {
      const recent = new Map([[itemIdOf(1), [D(0), D(-1)]]]);
      expect(plan({ kind: 'SUBMIT' }, { recentDifferences: recent }).plans[0]!.freeze.shortStreak).toBe(1);
    });

    it('is 0 for an item that is not short now, however short it was before', () => {
      const recent = new Map([[itemIdOf(2), [D(-1), D(-1)]]]);
      const over = [line(2, { countedQty: D(101), currentCost: 100 })];
      expect(planFreeze({ lines: over, onHand, settings, recentDifferences: recent, mode: { kind: 'SUBMIT' }, signedAt }).plans[0]!.freeze.shortStreak).toBe(0);
    });

    it('is 0 everywhere when the setting is off, and for a skipped line', () => {
      const off = { ...settings, flagRepeat: false };
      const recent = new Map([[itemIdOf(1), [D(-2), D(-1)]]]);
      expect(plan({ kind: 'SUBMIT' }, { settings: off, recentDifferences: recent }).plans[0]!.freeze.shortStreak).toBe(0);
      expect(plan({ kind: 'SUBMIT' }, { recentDifferences: new Map([[itemIdOf(4), [D(-1)]]]) }).plans[3]!.freeze.shortStreak).toBe(0);
    });
  });

  describe('a Manager signs her own count (SELF_SIGN)', () => {
    const causes = new Map([
      [lineIdOf(1), { cause: 'PREP_NOT_LOGGED' as const, note: null }],
      [lineIdOf(5), { cause: 'SPOILAGE' as const, note: null }],
    ]);
    const mode: FreezeMode = { kind: 'SELF_SIGN', actorId: 'isabel', causes };
    const { plans, missingCauses } = plan(mode);
    const byName = new Map(plans.map((p) => [p.itemName, p]));

    it('writes off the outside-range lines with her cause, and accepts the within-range one', () => {
      expect(byName.get('Sugar, white')!.freeze).toMatchObject({ decision: 'WRITE_OFF', cause: 'PREP_NOT_LOGGED', decidedById: 'isabel', decidedAt: signedAt, directorFlagged: true });
      expect(byName.get('Rice')!.freeze).toMatchObject({ decision: 'ACCEPTED', decidedById: 'isabel' });
      expect(missingCauses).toEqual([]);
    });

    it('posts one adjustment per NON-ZERO line with the signed difference and the frozen cost, and nothing for matched or skipped ones', () => {
      expect([...byName].filter(([, p]) => p.post).map(([name, p]) => [name, p.post!.quantity.toString(), p.post!.unitCost.toString(), p.post!.reason])).toEqual([
        ['Sugar, white', '-16', '183', 'Prep use not logged'],
        ['Rice', '-1', '100', 'Within range · accepted'],
        ['Eggs', '-5', '520', 'Spoilage or spill'],
      ]);
      expect(byName.get('Oil')!.post).toBeNull();
      expect(byName.get('Tea')!.post).toBeNull();
      expect(byName.get('Oil')!.freeze.decision).toBeUndefined();
    });

    it('flags the outside-range lines to the Director; a line at or above the alert amount also raises the alert', () => {
      expect(byName.get('Sugar, white')!.flagged).toBe(true);
      expect(byName.get('Rice')!.flagged).toBe(false);
      expect(byName.get('Sugar, white')!.alertValueKes).toBeNull(); // KES 2,928 is under KES 5,000
      const tight = plan(mode, { settings: { ...settings, directorAlertKes: 2600 } });
      const eggs = tight.plans.find((p) => p.itemName === 'Eggs')!;
      expect(eggs.alertValueKes).toBe(-2600);
      expect(eggs.freeze).toMatchObject({ directorAlert: true, directorFlagged: true });
      expect(tight.plans.find((p) => p.itemName === 'Sugar, white')!.alertValueKes).toBe(-2928);
      expect(tight.plans.find((p) => p.itemName === 'Rice')!.alertValueKes).toBeNull();
    });

    it('an outside-range line with no cause is reported, and "Other" needs a note', () => {
      const missing = plan({ kind: 'SELF_SIGN', actorId: 'isabel', causes: new Map([[lineIdOf(1), { cause: 'OTHER' as const, note: null }]]) });
      expect(missing.missingCauses).toEqual([lineIdOf(1), lineIdOf(5)]);
      const withNote = plan({ kind: 'SELF_SIGN', actorId: 'isabel', causes: new Map([[lineIdOf(1), { cause: 'OTHER' as const, note: 'Dropped crate' }], [lineIdOf(5), { cause: 'LOSS' as const, note: null }]]) });
      expect(withNote.missingCauses).toEqual([]);
      expect(withNote.plans[0]!.post!.reason).toBe('Other: Dropped crate');
    });
  });

  it('a line with no number is never judged, adjusted or flagged, even with expected stock behind it', () => {
    const tea = plan({ kind: 'SELF_SIGN', actorId: 'isabel', causes: new Map() }).plans.find((p) => p.itemName === 'Tea')!;
    expect(tea).toMatchObject({ post: null, flagged: false, alertValueKes: null });
    expect(tea.freeze.result).toBe('NOT_COUNTED');
  });

  it('an item with no stock on the ledger and a number typed is outside the range (expected 0 means any difference exceeds)', () => {
    const only = [line(6, { countedQty: D(1), currentCost: 10 })];
    const p = planFreeze({ lines: only, onHand: new Map(), settings, recentDifferences: none, mode: { kind: 'SUBMIT' }, signedAt }).plans[0]!;
    expect(p.freeze).toMatchObject({ result: 'EXCEEDS' });
    expect(p.freeze.expectedQty.toString()).toBe('0');
  });
});

describe('adjustmentReason', () => {
  it('is the cause words, with the note after them', () => {
    expect(adjustmentReason('MISCOUNT', null)).toBe('Miscount');
    expect(adjustmentReason('OTHER', 'Dropped crate')).toBe('Other: Dropped crate');
  });
});
