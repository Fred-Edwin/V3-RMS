import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { checkCountResultSchema, confirmPreviewSchema, countViewSchema, deliveryRowSchema } from './_shared/deliveries-contract';
import type { DeliveryLineRecord, DeliveryRecord, DeliveryRowRecord } from './deliveries-repository';
import { confirmerTitleOf, countViewWire, differingOf, previewWire, rowWire } from './deliveries-view';

const D = (n: number | string) => new Prisma.Decimal(n);
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-10-09T12:00:00.000Z');
const SENT = 24680; // a recognisable sent figure to hunt for in every response

const lineOf = (n: number, over: Partial<{ sent: number; counted: number | null; checks: number; reason: DeliveryLineRecord['countReason'] }> = {}): DeliveryLineRecord =>
  ({
    id: U(n),
    dispatchId: U(1),
    inventoryItemId: U(100 + n),
    sentQty: D(over.sent ?? SENT),
    requestedQty: D(SENT + 1),
    countedQty: over.counted === undefined ? null : over.counted === null ? null : D(over.counted),
    checkCount: over.checks ?? 0,
    countedTwice: false,
    countReason: over.reason ?? null,
    countReasonNote: null,
    unitCostAtDispatch: D('777.77'),
    item: { id: U(100 + n), name: `Item ${n}`, usageUnit: 'kg', currentCost: D('888.88'), category: null },
    photos: [{ id: U(200 + n) }],
  }) as unknown as DeliveryLineRecord;

const recOf = (lines: DeliveryLineRecord[]): DeliveryRecord =>
  ({
    id: U(1),
    reference: 'DSP-NYR-0001',
    status: 'ON_THE_WAY',
    signedAt: NOW,
    arrivedAt: null,
    createdAt: NOW,
    departmentId: U(9),
    toSite: { id: U(8), name: 'Nyeri Town', code: 'NYR' },
    department: { id: U(9), name: 'Pastry' },
    lines,
    discrepancies: [],
  }) as unknown as DeliveryRecord;

/** Every key in the object, at any depth. */
const keysOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(keysOf) : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : [];

/** `gapCount` is the number of differing lines on a past delivery (History), not a quantity, so it is the one allowed name. */
const FORBIDDEN_KEYS = /^(?!gapCount$).*(sent|gap|requested|cost|value|price|kes|balance|onhand)/i;

describe('THE BLIND RULE: nothing before the confirm summary carries the sent figure', () => {
  const stages: Array<[string, DeliveryLineRecord[]]> = [
    ['nothing counted', [lineOf(1), lineOf(2)]],
    ['typed, not checked', [lineOf(1, { counted: 20000 }), lineOf(2, { counted: SENT })]],
    ['flagged once', [lineOf(1, { counted: 20000, checks: 1 }), lineOf(2, { counted: SENT, checks: 2 })]],
    ['final difference with a reason and a photo', [lineOf(1, { counted: 30000, checks: 2, reason: 'DAMAGED' }), lineOf(2, { counted: SENT, checks: 2 })]],
  ];

  it.each(stages)('the count view at "%s" has no sent, gap, cost or value key and parses against the contract', (_name, lines) => {
    const view = countViewWire(recOf(lines), new Map(), false);
    expect(countViewSchema.parse(view)).toBeTruthy();
    expect(keysOf(view).filter((k) => FORBIDDEN_KEYS.test(k))).toEqual([]);
  });

  it.each(stages)('no number in the count view or the check equals the sent figure at "%s" unless the person typed it', (_name, lines) => {
    const rec = recOf(lines);
    const view = countViewWire(rec, new Map(), false);
    const check = { differing: differingOf(rec), final: true, reasonsComplete: true, view };
    expect(checkCountResultSchema.parse(check)).toBeTruthy();
    const typed = new Set(lines.flatMap((l) => (l.countedQty ? [l.countedQty.toString()] : [])));
    const numbers = JSON.stringify(check).match(/\d{3,}/g) ?? [];
    // the only long numbers are the ones typed by the person (and ids / dates, which are never the sent figure)
    expect(numbers.filter((n) => n === String(SENT) && !typed.has(n))).toEqual([]);
    expect(JSON.stringify(check)).not.toContain('777.77');
    expect(JSON.stringify(check)).not.toContain('888.88');
  });

  it('the check lists a differing line by name, typed number and direction only', () => {
    const rec = recOf([lineOf(1, { counted: 20000, checks: 1 }), lineOf(2, { counted: SENT, checks: 2 }), lineOf(3, { counted: 30000, checks: 2 })]);
    const rows = differingOf(rec);
    expect(rows).toEqual([
      { lineId: U(1), itemName: 'Item 1', countedQty: '20000', direction: 'SHORT', state: 'COUNT_AGAIN' },
      { lineId: U(3), itemName: 'Item 3', countedQty: '30000', direction: 'EXTRA', state: 'EXTRA' },
    ]);
    expect(rows.every((r) => Object.keys(r).sort().join() === 'countedQty,direction,itemName,lineId,state')).toBe(true);
  });

  it('a line typed but not yet checked shows no direction and no flag', () => {
    const view = countViewWire(recOf([lineOf(1, { counted: 20000, checks: 0 })]), new Map(), false);
    expect(view.lines[0]).toMatchObject({ state: 'COUNTED', attempt: 0, direction: null, recountUsed: false });
    expect(view.countAgainCount).toBe(0);
  });

  it('the view counts what the screen says: lines counted, lines to count again, whether Check and sign is open', () => {
    const view = countViewWire(recOf([lineOf(1, { counted: 20000, checks: 1 }), lineOf(2, { counted: SENT }), lineOf(3)]), new Map(), true);
    expect(view).toMatchObject({ lineCount: 3, countedCount: 2, countAgainCount: 1, canCheck: false, onBehalfOfDepartment: { name: 'Pastry' } });
  });

  it('the list rows of a delivery carry no sent figure either', () => {
    const row = {
      id: U(1),
      reference: 'DSP-NYR-0001',
      status: 'ON_THE_WAY',
      signedAt: NOW,
      arrivedAt: null,
      countedAt: null,
      onBehalf: false,
      department: { id: U(9), name: 'Pastry' },
      carrier: { id: U(7), name: 'Van', kind: 'VEHICLE' },
      requisition: { type: 'MORNING' },
      countedBy: null,
      lines: [{ id: U(2), countedQty: null }],
      discrepancies: [],
    } as unknown as DeliveryRowRecord;
    const wire = rowWire(row, { now: NOW, branchManager: false, departmentId: U(9) });
    expect(deliveryRowSchema.parse(wire)).toBeTruthy();
    expect(keysOf(wire).filter((k) => FORBIDDEN_KEYS.test(k))).toEqual([]);
    expect(wire).toMatchObject({ stage: 'ON_THE_WAY', countStarted: false, result: null, gapCount: null, can: { count: true, confirmOnBehalf: false } });
  });
});

describe('the confirm summary (V5) is the one place the sent figure appears', () => {
  const person = { id: U(5), name: 'Wanjiru', initials: 'W', roleLabel: 'Pastry Department Head' };
  const final = recOf([lineOf(1, { counted: 18000, sent: 20000, checks: 2, reason: 'NOT_IN_THE_BOX' }), lineOf(2, { counted: 5, sent: 5, checks: 2 }), lineOf(3, { counted: 26, sent: 24, checks: 2 })]);

  it('reveals sent and the signed gap for a differing line, names only for a match', () => {
    const preview = previewWire(final, person, false);
    expect(confirmPreviewSchema.parse(preview)).toBeTruthy();
    expect(preview.matchingLines).toEqual([{ lineId: U(2), itemName: 'Item 2' }]);
    expect(preview.differingLines.map((l) => [l.sentQty, l.countedQty, l.gapQty, l.direction, l.photoCount])).toEqual([
      ['20000', '18000', '-2000', 'SHORT', 1],
      ['24', '26', '2', 'EXTRA', 1],
    ]);
  });
  it('cannot be confirmed while a difference has no reason, and says so on the wire', () => {
    expect(previewWire(final, person, false).canConfirm).toBe(false);
    const withReasons = recOf([lineOf(1, { counted: 18000, sent: 20000, checks: 2, reason: 'DAMAGED' })]);
    expect(previewWire(withReasons, person, false).canConfirm).toBe(true);
  });
  it('the Branch Manager signing for a department is marked on behalf of it', () => {
    expect(previewWire(final, person, true).onBehalfOfDepartment).toEqual({ id: U(9), name: 'Pastry' });
    expect(previewWire(final, person, false).onBehalfOfDepartment).toBeNull();
  });
});

describe('titles, not names', () => {
  const dept = { id: U(9), name: 'Barista' };
  it('a head is "Barista Department Head", a member their role, the Branch Manager "Branch Manager" when on behalf', () => {
    const base = { department: dept };
    expect(confirmerTitleOf({ ...base, onBehalf: false, countedBy: { id: 'u', name: 'N', role: 'BARISTA', isDepartmentHead: true, departmentId: U(9) } })).toBe('Barista Department Head');
    expect(confirmerTitleOf({ ...base, onBehalf: false, countedBy: { id: 'u', name: 'N', role: 'BARISTA', isDepartmentHead: false, departmentId: U(9) } })).toBe('Barista');
    expect(confirmerTitleOf({ ...base, onBehalf: true, countedBy: { id: 'u', name: 'N', role: 'MANAGER', isDepartmentHead: false, departmentId: null } })).toBe('Branch Manager');
    expect(confirmerTitleOf({ ...base, onBehalf: false, countedBy: null })).toBeNull();
  });
});
