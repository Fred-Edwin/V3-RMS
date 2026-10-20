import { describe, expect, it } from 'vitest';
import { addMonthsClamped, appealDeadline, decisionDueBy, isInsideEndDate, overdueDays, recordableFrom, validUntilOf } from './conduct-dates';
import { reduceTargets, suggestLevel } from './conduct-ladder';
import { noticeNumberLabel, type ConductStatus } from './conduct-model';
import { ACTIVE_STATUSES, nextStatus, statusesAllowing, tryNextStatus, type ConductMove } from './conduct-status';
import { parseNairobiDate } from '../../_shared/time/nairobi-time';

const ALL_STATUSES: ConductStatus[] = ['ISSUED', 'RECORDED', 'SIGNED', 'GIVEN_NOT_SIGNED', 'APPEALED', 'KEPT', 'REPLACED', 'WITHDRAWN', 'ENDED'];
const ALL_MOVES: ConductMove[] = ['SIGN', 'RECORD_NOT_SIGNED', 'APPEAL', 'KEEP', 'REDUCE', 'WITHDRAW', 'END'];

describe('nextStatus', () => {
  const allowed: [ConductStatus, ConductMove, ConductStatus][] = [
    ['ISSUED', 'SIGN', 'SIGNED'],
    ['ISSUED', 'RECORD_NOT_SIGNED', 'GIVEN_NOT_SIGNED'],
    ['ISSUED', 'APPEAL', 'APPEALED'],
    ['ISSUED', 'END', 'ENDED'],
    ['ISSUED', 'WITHDRAW', 'WITHDRAWN'],
    ['ISSUED', 'REDUCE', 'REPLACED'],
    ['RECORDED', 'APPEAL', 'APPEALED'],
    ['RECORDED', 'END', 'ENDED'],
    ['RECORDED', 'WITHDRAW', 'WITHDRAWN'],
    ['RECORDED', 'REDUCE', 'REPLACED'],
    ['SIGNED', 'APPEAL', 'APPEALED'],
    ['SIGNED', 'END', 'ENDED'],
    ['SIGNED', 'WITHDRAW', 'WITHDRAWN'],
    ['SIGNED', 'REDUCE', 'REPLACED'],
    ['GIVEN_NOT_SIGNED', 'SIGN', 'SIGNED'],
    ['GIVEN_NOT_SIGNED', 'APPEAL', 'APPEALED'],
    ['GIVEN_NOT_SIGNED', 'END', 'ENDED'],
    ['GIVEN_NOT_SIGNED', 'WITHDRAW', 'WITHDRAWN'],
    ['GIVEN_NOT_SIGNED', 'REDUCE', 'REPLACED'],
    ['KEPT', 'REDUCE', 'REPLACED'],
    ['APPEALED', 'KEEP', 'KEPT'],
    ['APPEALED', 'REDUCE', 'REPLACED'],
    ['APPEALED', 'WITHDRAW', 'WITHDRAWN'],
    ['KEPT', 'END', 'ENDED'],
    ['KEPT', 'WITHDRAW', 'WITHDRAWN'],
    ['ENDED', 'WITHDRAW', 'WITHDRAWN'],
  ];

  it.each(allowed)('%s + %s → %s', (from, move, to) => {
    expect(nextStatus(from, move)).toBe(to);
  });

  it('refuses every move that is not in the table with 409 INVALID_TRANSITION', () => {
    const listed = new Set(allowed.map(([from, move]) => `${from}:${move}`));
    for (const from of ALL_STATUSES) {
      for (const move of ALL_MOVES) {
        if (listed.has(`${from}:${move}`)) continue;
        expect(tryNextStatus(from, move)).toBeNull();
        expect(() => nextStatus(from, move)).toThrowError(expect.objectContaining({ statusCode: 409, code: 'INVALID_TRANSITION' }));
      }
    }
  });

  it('a replaced or withdrawn notice cannot move at all, and an appealed one never ends by itself', () => {
    for (const move of ALL_MOVES) {
      expect(tryNextStatus('REPLACED', move)).toBeNull();
      expect(tryNextStatus('WITHDRAWN', move)).toBeNull();
    }
    expect(tryNextStatus('APPEALED', 'END')).toBeNull();
    expect(tryNextStatus('APPEALED', 'SIGN')).toBeNull();
  });

  it('lists the statuses a move starts from, and the active set', () => {
    expect(statusesAllowing('APPEAL')).toEqual(['ISSUED', 'RECORDED', 'SIGNED', 'GIVEN_NOT_SIGNED']);
    expect(ACTIVE_STATUSES).not.toContain('ENDED');
    expect(ACTIVE_STATUSES).toContain('APPEALED');
  });
});

describe('suggestLevel', () => {
  it('walks the ladder', () => {
    expect(suggestLevel([])).toEqual({ suggested: 'VERBAL_NOTE', finalAllowed: false, finalAlreadyActive: false });
    expect(suggestLevel([{ level: 'VERBAL_NOTE' }])).toEqual({ suggested: 'WRITTEN_WARNING', finalAllowed: false, finalAlreadyActive: false });
    expect(suggestLevel([{ level: 'WRITTEN_WARNING' }])).toEqual({ suggested: 'FINAL_WRITTEN_WARNING', finalAllowed: true, finalAlreadyActive: false });
    expect(suggestLevel([{ level: 'FINAL_WRITTEN_WARNING' }])).toEqual({ suggested: null, finalAllowed: false, finalAlreadyActive: true });
  });

  it('a verbal and a written together suggest final', () => {
    expect(suggestLevel([{ level: 'VERBAL_NOTE' }, { level: 'WRITTEN_WARNING' }]).suggested).toBe('FINAL_WRITTEN_WARNING');
  });

  it('reduction targets sit below the level', () => {
    expect(reduceTargets('FINAL_WRITTEN_WARNING')).toEqual(['VERBAL_NOTE', 'WRITTEN_WARNING']);
    expect(reduceTargets('WRITTEN_WARNING')).toEqual(['VERBAL_NOTE']);
    expect(reduceTargets('VERBAL_NOTE')).toEqual([]);
  });
});

describe('dates', () => {
  it('adds calendar months and clamps to the month end', () => {
    expect(addMonthsClamped(parseNairobiDate('2026-10-09'), 6)).toBe('2027-04-09');
    expect(addMonthsClamped(parseNairobiDate('2026-08-31'), 6)).toBe('2027-02-28');
    expect(addMonthsClamped(parseNairobiDate('2027-08-31'), 6)).toBe('2028-02-29');
    expect(addMonthsClamped(parseNairobiDate('2026-10-12'), 3)).toBe('2027-01-12');
    expect(addMonthsClamped(parseNairobiDate('2026-11-30'), 12)).toBe('2027-11-30');
  });

  it('uses the Nairobi day of the issue instant, not the UTC day', () => {
    // 22:30 UTC on 8 Oct is 01:30 on 9 Oct in Nairobi
    expect(validUntilOf(new Date('2026-10-08T22:30:00Z'), 6)).toBe('2027-04-09');
  });

  it('closes the appeal window at 23:59 Nairobi on the 7th day', () => {
    const issued = new Date('2026-10-09T13:42:00Z'); // Fri 9 Oct, 16:42 Nairobi
    const deadline = appealDeadline(issued, 7);
    expect(deadline.toISOString()).toBe('2026-10-16T20:59:59.999Z'); // 23:59:59 Nairobi on Fri 16 Oct
  });

  it('opens "not signed" the day after the sign limit', () => {
    const issued = new Date('2026-10-09T13:42:00Z');
    expect(recordableFrom(issued, 3).toISOString()).toBe('2026-10-12T21:00:00.000Z'); // 00:00 Nairobi on Tue 13 Oct
  });

  it('counts overdue whole days after the due moment', () => {
    const due = decisionDueBy(new Date('2026-10-10T06:15:00Z'), 7); // end of 17 Oct Nairobi
    expect(overdueDays(due, new Date('2026-10-17T20:00:00Z'))).toBe(0);
    expect(overdueDays(due, new Date('2026-10-18T10:00:00Z'))).toBe(1);
    expect(overdueDays(due, new Date('2026-10-20T10:00:00Z'))).toBe(3);
  });

  it('is inside the end date through its day', () => {
    const until = new Date('2027-04-09T00:00:00Z');
    expect(isInsideEndDate(until, new Date('2027-04-09T20:59:00Z'))).toBe(true); // 23:59 Nairobi
    expect(isInsideEndDate(until, new Date('2027-04-09T21:00:00Z'))).toBe(false); // 00:00 on the 10th
  });
});

describe('number label', () => {
  it('pads to four digits and is null for a verbal note', () => {
    expect(noticeNumberLabel(7)).toBe('WRN-0007');
    expect(noticeNumberLabel(12345)).toBe('WRN-12345');
    expect(noticeNumberLabel(null)).toBeNull();
  });
});
