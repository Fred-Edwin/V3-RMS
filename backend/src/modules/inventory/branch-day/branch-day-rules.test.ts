/**
 * Branch day: the pure rules of contract §5, as state tables. No database, no clock: the rules take the clock in.
 */
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  blockersOf,
  canCloseOf,
  correctionWindowOpen,
  dateText,
  dayWindow,
  departmentPages,
  differenceOf,
  homeActionOf,
  isCounted,
  lastNightQtyOf,
  money,
  nairobiHour,
  openingQtyOf,
  previousDate,
  qty,
  sheetLayout,
  summaryOf,
  usageEntryQty,
  usedTodayOf,
  valueOf,
  type BlockerFacts,
} from './branch-day-rules';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

describe('the Nairobi day', () => {
  it('a business date runs from 00:00 to 24:00 at +03:00', () => {
    const { start, end } = dayWindow(new Date('2026-10-10T00:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-10-09T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-10T21:00:00.000Z');
  });
  it('the day before is the calendar day before, and a date prints as YYYY-MM-DD', () => {
    expect(dateText(previousDate(new Date('2026-10-10T00:00:00.000Z')))).toBe('2026-10-09');
    expect(dateText(previousDate(new Date('2026-03-01T00:00:00.000Z')))).toBe('2026-02-28');
  });
  it.each([
    ['2026-10-10T08:59:59.000Z', 11],
    ['2026-10-10T09:00:00.000Z', 12],
    ['2026-10-10T20:59:00.000Z', 23],
    ['2026-10-10T21:00:00.000Z', 0],
  ])('%s is hour %i in Nairobi', (iso, hour) => {
    expect(nairobiHour(new Date(iso))).toBe(hour);
  });
});

describe('opening stock (§5.2): the accepted figure, else last night, else the ledger at the start of the day', () => {
  it.each([
    ['checked and accepted', '7', '8', '9', '7'],
    ['checked, recounted to zero', '0', '8', '9', '0'],
    ['not checked: last night stands', null, '8', '9', '8'],
    ['not checked, last night was zero', null, '0', '9', '0'],
    ['no earlier close: the ledger position', null, null, '9', '9'],
    ['no earlier close and nothing in stock', null, null, '0', '0'],
  ])('%s', (_name, accepted, lastNight, ledger, expected) => {
    const opening = openingQtyOf({ accepted: accepted === null ? null : D(accepted), lastNight: lastNight === null ? null : D(lastNight), ledgerAtStart: D(ledger) });
    expect(opening.toString()).toBe(expected);
  });
  it('"last night" shown to the head ignores the accepted figure', () => {
    expect(lastNightQtyOf({ lastNight: D(8), ledgerAtStart: D(9) }).toString()).toBe('8');
    expect(lastNightQtyOf({ lastNight: null, ledgerAtStart: D(9) }).toString()).toBe('9');
  });
  it('the difference is counted minus last night, signed', () => {
    expect(differenceOf(D(7), D(8)).toString()).toBe('-1');
    expect(differenceOf(D('8.5'), D(8)).toString()).toBe('0.5');
    expect(differenceOf(D(8), D(8)).isZero()).toBe(true);
  });
});

describe('Used today = opening + received − waste − closing (§5.4)', () => {
  it.each([
    ['plain use', '10', '0', '0', '7', '3'],
    ['with a delivery', '10', '5', '0', '7', '8'],
    ['with waste', '10', '0', '2', '7', '1'],
    ['received and wasted', '10', '5', '2', '7', '6'],
    ['a zero-use item', '4', '0', '0', '4', '0'],
    ['a surplus stays negative, flagged to nobody', '4', '0', '0', '6', '-2'],
    ['decimals', '2.5', '0', '0.25', '1.5', '0.75'],
  ])('%s', (_name, opening, received, waste, closing, used) => {
    expect(usedTodayOf(D(opening), D(received), D(waste), D(closing))?.toString()).toBe(used);
  });
  it('is null until the department has counted', () => {
    expect(usedTodayOf(D(10), D(0), D(0), null)).toBeNull();
  });
  it('the usage entry is the count minus the ledger position, so the ledger equals the count afterwards', () => {
    expect(usageEntryQty(D(7), D(10)).toString()).toBe('-3');
    expect(usageEntryQty(D(7), D(7)).isZero()).toBe(true); // an item that moved nothing posts none
    expect(usageEntryQty(D(8), D(7)).toString()).toBe('1'); // another movement is netted, not hidden
  });
});

describe('money (§5.4): two decimals, half up, and a line value is what a department adds up', () => {
  it.each([
    ['2.5', '1.005', '2.51'],
    ['3', '0.335', '1.01'],
    ['0', '99', '0.00'],
    ['-2', '10', '-20.00'],
    ['1.5', '80', '120.00'],
  ])('%s × %s = %s', (quantity, cost, expected) => {
    expect(money(valueOf(D(quantity), D(cost)))).toBe(expected);
  });
  it('a quantity has no trailing zeros', () => {
    expect(qty(D('3.0000'))).toBe('3');
    expect(qty(D('2.5000'))).toBe('2.5');
    expect(qty(D('-1'))).toBe('-1');
  });
});

describe('the department and the blockers (§5.6)', () => {
  const dept = (name: string, over: Partial<BlockerFacts['departments'][number]> = {}): BlockerFacts['departments'][number] => ({
    id: `d-${name}`,
    name,
    status: 'COUNTED',
    itemCount: 5,
    countedAt: new Date('2026-10-10T16:00:00.000Z'),
    openingState: 'ACCEPTED',
    ...over,
  });
  const facts = (over: Partial<BlockerFacts> = {}): BlockerFacts => ({ departments: [dept('Kitchen')], onTheWay: [], openDiscrepancies: [], ...over });

  it('a department with no items counts as done, one with items counts when its status says so', () => {
    expect(isCounted({ status: 'NOT_STARTED', itemCount: 0 })).toBe(true);
    expect(isCounted({ status: 'NOT_STARTED', itemCount: 3 })).toBe(false);
    expect(isCounted({ status: 'COUNTED', itemCount: 3 })).toBe(true);
  });

  it('everything done and delivered: two ticks, nothing blocks, the day can close', () => {
    const blockers = blockersOf(facts());
    expect(blockers.map((b) => [b.kind, b.severity])).toEqual([
      ['DELIVERIES_CONFIRMED', 'OK'],
      ['ALL_COUNTED', 'OK'],
    ]);
    expect(summaryOf(blockers)).toEqual({ todo: 0, toKnow: 0 });
    expect(canCloseOf('OPEN', blockers)).toBe(true);
  });

  it('a delivery that left the store and is not confirmed blocks, one line each, and the department is named', () => {
    const signedAt = new Date('2026-10-10T12:05:00.000Z');
    const blockers = blockersOf(
      facts({
        onTheWay: [
          { id: 'x1', reference: 'DSP-NYR-0231', signedAt, department: { id: 'd-Barista', name: 'Barista' } },
          { id: 'x2', reference: 'DSP-NYR-0232', signedAt, department: { id: 'd-Pastry', name: 'Pastry' } },
        ],
      }),
    );
    expect(blockers.filter((b) => b.severity === 'BLOCKS').map((b) => b.dispatch?.reference)).toEqual(['DSP-NYR-0231', 'DSP-NYR-0232']);
    expect(blockers[0]?.department?.name).toBe('Barista');
    expect(blockers.some((b) => b.kind === 'DELIVERIES_CONFIRMED')).toBe(false);
    expect(canCloseOf('OPEN', blockers)).toBe(false);
  });

  it('a department not counted blocks; the delivery line comes first, then the count lines, then what to know', () => {
    const blockers = blockersOf(
      facts({
        departments: [dept('Kitchen'), dept('Barista', { status: 'NOT_STARTED', countedAt: null, openingState: 'NOT_CHECKED' }), dept('Pastry', { openingState: 'NOT_CHECKED' })],
      }),
    );
    expect(blockers.map((b) => [b.kind, b.severity, b.department?.name ?? null])).toEqual([
      ['DELIVERIES_CONFIRMED', 'OK', null],
      ['DEPARTMENT_NOT_COUNTED', 'BLOCKS', 'Barista'],
      ['OPENING_NOT_CHECKED', 'INFO', 'Pastry'],
    ]);
    expect(summaryOf(blockers)).toEqual({ todo: 1, toKnow: 1 });
  });

  it('a missing opening check never blocks, and is only listed once the department has counted', () => {
    const blockers = blockersOf(facts({ departments: [dept('Kitchen', { openingState: 'NOT_CHECKED' }), dept('Barista', { status: 'NOT_STARTED', countedAt: null, openingState: 'NOT_CHECKED' })] }));
    expect(blockers.filter((b) => b.kind === 'OPENING_NOT_CHECKED').map((b) => b.department?.name)).toEqual(['Kitchen']);
    expect(blockers.filter((b) => b.severity === 'BLOCKS')).toHaveLength(1);
  });

  it('an open discrepancy never blocks: it rides on the delivery tick', () => {
    const blockers = blockersOf(facts({ openDiscrepancies: [{ id: 'q1', reference: 'DSC-NYR-0007' }] }));
    expect(blockers[0]?.kind).toBe('DELIVERIES_CONFIRMED');
    expect(blockers[0]?.discrepancies).toEqual([{ id: 'q1', reference: 'DSC-NYR-0007' }]);
    expect(canCloseOf('OPEN', blockers)).toBe(true);
  });

  it('ALL_COUNTED names the department that signed last and when', () => {
    const blockers = blockersOf(
      facts({
        departments: [
          dept('Kitchen', { countedAt: new Date('2026-10-10T15:00:00.000Z') }),
          dept('Housekeeping', { countedAt: new Date('2026-10-10T16:24:00.000Z') }),
          dept('Service', { status: 'NOT_STARTED', itemCount: 0, countedAt: null }),
        ],
      }),
    );
    const all = blockers.find((b) => b.kind === 'ALL_COUNTED');
    expect(all?.lastDepartment?.name).toBe('Housekeeping');
    expect(all?.at).toBe('2026-10-10T16:24:00.000Z');
  });

  it('a department with no items never blocks and has no opening line', () => {
    const blockers = blockersOf(facts({ departments: [dept('Service', { status: 'NOT_STARTED', itemCount: 0, countedAt: null, openingState: 'NOT_CHECKED' })] }));
    expect(blockers.map((b) => b.kind)).toEqual(['DELIVERIES_CONFIRMED', 'ALL_COUNTED']);
  });

  it('a closed day cannot close again', () => {
    expect(canCloseOf('CLOSED', blockersOf(facts()))).toBe(false);
  });
});

describe("the head's one button (gap 8): it switches at 12:00 Nairobi", () => {
  const at = (hhmm: string) => new Date(`2026-10-10T${hhmm}:00.000+03:00`);
  it.each([
    ['07:30', false, 'NOT_CHECKED', 'CHECK_OPENING'],
    ['11:59', false, 'NOT_CHECKED', 'CHECK_OPENING'],
    ['12:00', false, 'NOT_CHECKED', 'COUNT'],
    ['19:00', false, 'NOT_CHECKED', 'COUNT'],
    ['07:30', false, 'ACCEPTED', 'COUNT'],
    ['07:30', false, 'RECOUNTED', 'COUNT'],
    ['19:00', true, 'ACCEPTED', 'NONE'],
    ['07:30', true, 'NOT_CHECKED', 'NONE'],
  ] as const)('%s, signed=%s, opening %s → %s', (time, signed, opening, action) => {
    expect(homeActionOf(at(time), signed, opening)).toBe(action);
  });
});

describe('the correction window (§5.10): until that department’s next opening is accepted', () => {
  it('is open while no later opening exists, closed once one does', () => {
    expect(correctionWindowOpen(false)).toBe(true);
    expect(correctionWindowOpen(true)).toBe(false);
  });
});

describe('the day sheet pages (§5.12): the cover is page 1; a department takes at least one page, then one per 16 rows', () => {
  it.each([
    [0, 1],
    [1, 1],
    [6, 1],
    [16, 1],
    [17, 2],
    [32, 2],
    [33, 3],
    [130, 9],
  ])('%i items take %i page(s)', (items, pages) => {
    expect(departmentPages(items)).toBe(pages);
  });
  it('lays the departments out after the cover and counts the pages', () => {
    expect(sheetLayout([6, 0, 17, 16])).toEqual({ pages: [2, 3, 4, 6], pageCount: 6 });
    expect(sheetLayout([])).toEqual({ pages: [], pageCount: 1 });
  });
});
