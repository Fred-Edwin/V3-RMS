import { describe, expect, it } from 'vitest';
import { BRANCH_DAY_ERROR_CODES, CORRECTION_REASON_TEXT, DAY_STATUS_TEXT } from '../types/branch-day-contract';
import type { Blocker, OpeningDifference } from '../types/branch-day-contract';
import {
  BRANCH_DAY_BLOCKS_THE_CLOSE,
  BRANCH_DAY_BUTTONS,
  BRANCH_DAY_ERROR_COPY,
  BRANCH_DAY_FIGURES,
  BRANCH_DAY_MESSAGES,
  BRANCH_DAY_STATES,
  BRANCH_DAY_STATES_COPY,
  blockerCopy,
  blockersHeading,
  dayStatusChip,
  openingChip,
  openingDifferenceLine,
} from './branch-day-copy';

const clock = (iso: string): string => (iso.startsWith('2026-10-07T12:05') ? '3:05 pm' : '7:24 pm');
const milk: OpeningDifference = { itemId: 'i1', itemName: 'Milk 1L', unit: 'Packets', lastNightQty: '8', countedQty: '7', difference: '-1' };
const blocker = (over: Partial<Blocker>): Blocker => ({
  kind: 'OPENING_NOT_CHECKED',
  severity: 'INFO',
  department: null,
  dispatch: null,
  discrepancies: [],
  at: null,
  lastDepartment: null,
  ...over,
});

describe('branch day wording (Paper B18)', () => {
  it('has the eight figures, four states and the three-line buttons table B18 draws, in B18 words', () => {
    expect(BRANCH_DAY_FIGURES.map((f) => f.word)).toEqual([
      'Opening stock',
      'Received',
      'Waste',
      'Closing stock',
      'Used today',
      'Yesterday',
      'Used value (KES)',
      'Closing stock value (KES)',
    ]);
    expect(BRANCH_DAY_STATES).toHaveLength(4);
    expect(BRANCH_DAY_BLOCKS_THE_CLOSE).toMatch(/open discrepancy never does/);
    expect(BRANCH_DAY_BUTTONS.closeDay).toBe('Close the day');
    expect(BRANCH_DAY_BUTTONS.correctCount).toBe('Correct a count');
    expect(BRANCH_DAY_BUTTONS.confirmFor('Kitchen')).toBe('Confirm for Kitchen');
    expect(CORRECTION_REASON_TEXT).toEqual({ COUNTED_WRONGLY: 'Counted wrongly', ITEM_WAS_MISSED: 'Item was missed', OTHER: 'Other' });
    expect(DAY_STATUS_TEXT).toEqual({ OPEN: 'Open', CLOSED: 'Closed', CORRECTED: 'Corrected' });
    expect(dayStatusChip('CORRECTED')).toBe('Corrected');
  });

  it('never uses the words the redesign removed', () => {
    const all = JSON.stringify([BRANCH_DAY_FIGURES, BRANCH_DAY_STATES, BRANCH_DAY_BLOCKS_THE_CLOSE, BRANCH_DAY_BUTTONS.closeDay, BRANCH_DAY_MESSAGES.afterClose, BRANCH_DAY_STATES_COPY, BRANCH_DAY_ERROR_COPY]);
    expect(all).not.toMatch(/reopen\b|reopening|unusual|threshold|reason is required|gap\b/i);
    // "consumption" and "counted" appear only in the "Never ..." notes of the table itself.
    const figures = BRANCH_DAY_FIGURES.map((f) => f.word).join(' ');
    expect(figures).not.toMatch(/consumption|counted/i);
  });

  it('the department chip reads as Paper B5 draws it', () => {
    expect(openingChip('NOT_CHECKED', [])).toBe('Opening not checked');
    expect(openingChip('RECOUNTED', [milk])).toBe('Opening 1 less · Milk 1L');
    expect(openingChip('RECOUNTED', [{ ...milk, difference: '2' }])).toBe('Opening 2 more · Milk 1L');
    expect(openingChip('ACCEPTED', [])).toBeNull();
    expect(openingChip('RECOUNTED', [milk, { ...milk, itemName: 'Sugar 2kg' }])).toBe('Opening: 2 differences');
    expect(openingDifferenceLine(milk)).toBe('8 last night, 7 this morning');
  });

  it('the blockers read as Paper B5, B7 and B14 draw them', () => {
    const housekeeping = { id: 'd5', name: 'Housekeeping' };
    expect(blockerCopy(blocker({ kind: 'DEPARTMENT_NOT_COUNTED', severity: 'BLOCKS', department: housekeeping }), clock, 5)).toEqual({
      title: 'Housekeeping has not counted',
      line: 'This blocks the close. The Housekeeping Department Head, or any active member of the department, can count it now.',
    });
    expect(blockerCopy(blocker({ kind: 'DELIVERIES_CONFIRMED', severity: 'OK', discrepancies: [{ id: 'x', reference: 'DSC-NYR-0007' }] }), clock, 5)).toEqual({
      title: 'Every delivery is confirmed',
      line: 'Five departments counted what arrived. One discrepancy is open, which does not block the close:',
    });
    expect(
      blockerCopy(
        blocker({
          kind: 'DELIVERY_NOT_CONFIRMED',
          severity: 'BLOCKS',
          department: { id: 'd1', name: 'Kitchen' },
          dispatch: { id: 'p', reference: 'DSP-NYR-0231', signedAt: '2026-10-07T12:05:00.000Z' },
        }),
        clock,
        5,
      ),
    ).toEqual({
      title: 'Kitchen has not confirmed its delivery',
      line: 'DSP-NYR-0231 left the store at 3:05 pm and is not counted yet. This blocks the close; an open discrepancy never does:',
    });
    expect(blockerCopy(blocker({ kind: 'ALL_COUNTED', severity: 'OK', at: '2026-10-07T16:24:00.000Z', lastDepartment: housekeeping }), clock, 5)).toEqual({
      title: 'All five departments have counted',
      line: 'Housekeeping signed its count at 7:24 pm.',
    });
    expect(blockerCopy(blocker({ department: { id: 'd4', name: 'Service' } }), clock, 5)).toEqual({
      title: 'Opening not checked: Service',
      line: "The Service day ran on last night's closing figure. This does not block the close.",
    });
  });

  it('the heading above the blockers reads as Paper B5, B7 and B14 draw it', () => {
    expect(blockersHeading(false, 1, 1)).toEqual({ title: 'Before the day can close', line: '1 thing to do. 1 more to know about.' });
    expect(blockersHeading(true, 0, 1)).toEqual({ title: 'Ready to close', line: 'Nothing is left to do. 1 thing to know about.' });
    expect(blockersHeading(false, 2, 0).line).toBe('2 things to do.');
  });

  it('the close and correction lines carry the day number', () => {
    expect(BRANCH_DAY_MESSAGES.closeDoes(43, 'DAY-NYR-0044')).toContain('Writes 43 usage entries to the stock ledger, one per item, each marked DAY-NYR-0044.');
    expect(BRANCH_DAY_MESSAGES.closedBanner('7:48 pm', '50,060', 43, 'DAY-NYR-0044')).toBe(
      'Day closed at 7:48 pm, signed by the Branch Manager. Used today KES 50,060. 43 usage entries were written to the stock ledger, each marked DAY-NYR-0044.',
    );
    expect(BRANCH_DAY_MESSAGES.correctionPosted('9:14 am', 'Flour 25kg', '1', '2', '48,060')).toBe(
      'Correction posted at 9:14 am: Flour 25kg, closing stock 1 → 2. The day’s Used value is now KES 48,060.',
    );
  });

  it('every screen has loading and error words and every error code has a line', () => {
    for (const copy of Object.values(BRANCH_DAY_STATES_COPY)) {
      expect(copy.loading.length).toBeGreaterThan(0);
      expect(copy.error.length).toBeGreaterThan(0);
    }
    expect(Object.keys(BRANCH_DAY_ERROR_COPY).sort()).toEqual([...BRANCH_DAY_ERROR_CODES].sort());
    expect(JSON.stringify([BRANCH_DAY_STATES_COPY, BRANCH_DAY_ERROR_COPY])).not.toMatch(/Peter|Grace|David|Samuel/);
  });
});
