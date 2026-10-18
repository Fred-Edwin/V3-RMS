import { describe, expect, it } from 'vitest';

import { weekPlan } from './my-week';

const shift = (date: string, paidMinutes: number) => ({ entryId: date, date, shiftName: 'Morning', letter: 'M', colour: 'BLUE' as const, startTime: '06:00', endTime: '14:00', unpaidBreakMinutes: 0, paidMinutes });

describe('My week plan', () => {
  const plan = weekPlan([shift('2026-10-13', 480), shift('2026-10-14', 480), shift('2026-10-20', 480)], '2026-10-12', '2026-10-13');

  it('draws seven bars, planned where there is a shift and a line where there is none', () => {
    expect(plan.bars.map((b) => b.letter).join('')).toBe('MTWTFSS');
    expect(plan.bars[1]).toMatchObject({ state: 'planned', today: true, label: 'Tuesday, 8 hours planned' });
    expect(plan.bars[0]).toMatchObject({ state: 'off', label: 'Monday, no shift' });
  });
  it('adds up this week only, not a shift in the next one', () => {
    expect(plan).toMatchObject({ hours: '16 h', hoursOf: 'planned this week', range: '12 TO 18 OCT' });
  });
  it('says so when nothing is planned', () => {
    expect(weekPlan([], '2026-10-12', '2026-10-12')).toMatchObject({ hours: '0 h', hoursOf: 'no shifts planned this week' });
  });
});
