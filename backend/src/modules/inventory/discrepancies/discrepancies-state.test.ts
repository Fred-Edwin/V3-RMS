import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { DISCREPANCY_ERROR_CODES, FINDINGS, FINDINGS_FOR, REMINDER_AFTER_HOURS } from './_shared/discrepancies-contract';
import { discrepancyError } from './discrepancies-errors';
import { directionOfGap, effectRowsOf, heldValueOf, isFindingAllowed, isHeld, lossKindOf, lossValueOf, postingsOf, reminderDue } from './discrepancies-state';

const D = (n: number | string) => new Prisma.Decimal(n);
const show = (rows: Array<{ place: string; quantity: Prisma.Decimal }>) => rows.map((r) => `${r.place} ${r.quantity.toString()}`);

describe('direction and which findings fit', () => {
  it('a negative gap is short and a positive one is extra', () => {
    expect(directionOfGap(D(-2))).toBe('SHORT');
    expect(directionOfGap(D(2))).toBe('EXTRA');
  });
  it('four findings for a short line and three for an extra one, as the contract lists', () => {
    expect(FINDINGS_FOR.SHORT).toHaveLength(4);
    expect(FINDINGS_FOR.EXTRA).toHaveLength(3);
    for (const f of FINDINGS) {
      expect(isFindingAllowed('SHORT', f)).toBe(FINDINGS_FOR.SHORT.includes(f));
      expect(isFindingAllowed('EXTRA', f)).toBe(FINDINGS_FOR.EXTRA.includes(f));
    }
    expect(isFindingAllowed('SHORT', 'PACKED_MORE')).toBe(false);
    expect(isFindingAllowed('EXTRA', 'PACKED_SHORT')).toBe(false);
    expect(isFindingAllowed('EXTRA', 'LOST_OR_DAMAGED')).toBe(false);
  });
});

describe('what each finding posts to the ledger (discrepancies.md, "What happens after the branch signs")', () => {
  it.each([
    // finding, gap, postings
    ['PACKED_SHORT', -2, ['CENTRAL_STORE 2']], // the 2 return to store stock
    ['LOST_OR_DAMAGED', -2, []], // the units already left: written off, no stock moves
    ['BRANCH_COUNTED_WRONG', -2, ['DEPARTMENT 2']], // all 20 arrived: the department is corrected up
    ['CANT_TELL', -2, []], // written off, unexplained
    ['PACKED_MORE', 2, ['CENTRAL_STORE -2']], // store stock goes down
    ['BRANCH_COUNTED_WRONG', 2, ['DEPARTMENT -2']], // the department is corrected down
    ['CANT_TELL', 2, []], // the extra is taken in, unexplained
  ] as const)('%s on a gap of %s', (finding, gap, expected) => {
    expect(show(postingsOf(finding, D(gap)))).toEqual(expected);
  });
  it('decimals keep their size', () => {
    expect(show(postingsOf('PACKED_SHORT', D('-0.25')))).toEqual(['CENTRAL_STORE 0.25']);
  });
  it('the preview adds the write-off row for a loss', () => {
    expect(show(effectRowsOf('LOST_OR_DAMAGED', D(-2)))).toEqual(['WRITTEN_OFF -2']);
    expect(show(effectRowsOf('PACKED_SHORT', D(-2)))).toEqual(['CENTRAL_STORE 2']);
    expect(show(effectRowsOf('CANT_TELL', D(2)))).toEqual(['WRITTEN_OFF 2']);
    expect(show(effectRowsOf('BRANCH_COUNTED_WRONG', D(-2)))).toEqual(['DEPARTMENT 2']);
  });
  it('a reversal posts the exact opposite of every row, so the gap nets out', () => {
    for (const finding of FINDINGS) {
      for (const gap of [D(-3), D(3)]) {
        if (!isFindingAllowed(directionOfGap(gap), finding)) continue;
        const rows = postingsOf(finding, gap);
        const net = rows.map((r) => r.quantity).concat(rows.map((r) => r.quantity.negated())).reduce((a, b) => a.add(b), D(0));
        expect(net.toString()).toBe('0');
      }
    }
  });
});

describe('loss and value', () => {
  it('only a loss carries a value, at the cost frozen at dispatch, to 2 decimals', () => {
    expect(lossKindOf('LOST_OR_DAMAGED')).toBe('LOSS');
    expect(lossKindOf('CANT_TELL')).toBe('LOSS');
    expect(lossKindOf('PACKED_SHORT')).toBe('PACKING_ERROR');
    expect(lossKindOf('PACKED_MORE')).toBe('PACKING_ERROR');
    expect(lossKindOf('BRANCH_COUNTED_WRONG')).toBe('NONE');
    expect(lossValueOf('LOST_OR_DAMAGED', D(-2), D(240))?.toString()).toBe('480');
    expect(lossValueOf('CANT_TELL', D(2), D('12.345'))?.toString()).toBe('24.69');
    expect(lossValueOf('PACKED_SHORT', D(-2), D(240))).toBeNull();
    expect(lossValueOf('BRANCH_COUNTED_WRONG', D(-2), D(240))).toBeNull();
  });
  it('the held gap is worth its size at the frozen cost', () => {
    expect(heldValueOf(D(-2), D(240)).toString()).toBe('480');
    expect(heldValueOf(D(3), D(10)).toString()).toBe('30');
  });
  it('Open on the list means the gap is held: OPEN, or a finding that was reversed', () => {
    expect(isHeld('OPEN')).toBe(true);
    expect(isHeld('REVERSED')).toBe(true);
    expect(isHeld('RECORDED')).toBe(false);
  });
});

describe('the reminder: 24 hours without a finding, then every day', () => {
  const since = new Date('2026-10-09T08:00:00.000Z');
  const at = (hours: number) => new Date(since.getTime() + hours * 3_600_000);
  it('the limit is the contract constant', () => {
    expect(REMINDER_AFTER_HOURS).toBe(24);
  });
  it.each([
    [23.9, null, false],
    [24, null, true],
    [30, null, true],
    [30, 24, false], // reminded at hour 24: not again before hour 48
    [47.9, 24, false],
    [48, 24, true],
    [72, 48, true],
  ] as const)('at hour %s with the last reminder at hour %s', (hour, last, due) => {
    expect(reminderDue({ since, reminderSentAt: last === null ? null : at(last) }, at(hour), REMINDER_AFTER_HOURS)).toBe(due);
  });
});

describe('error codes', () => {
  it.each(DISCREPANCY_ERROR_CODES.filter((c) => c !== 'INVALID_PIN'))('%s has a status and keeps its code', (code) => {
    const e = discrepancyError(code, 'message');
    expect(e.code).toBe(code);
    expect(e.statusCode).toBeGreaterThanOrEqual(400);
  });
  it('FINDING_NOT_ALLOWED is 422 and the two refusals about state are 409', () => {
    expect(discrepancyError('FINDING_NOT_ALLOWED', 'x').statusCode).toBe(422);
    expect(discrepancyError('FINDING_ALREADY_RECORDED', 'x').statusCode).toBe(409);
    expect(discrepancyError('FINDING_NOT_REVERSIBLE', 'x').statusCode).toBe(409);
  });
});
