import { describe, expect, it } from 'vitest';

import { dayLine, dayText, differenceText, plural, signedByText, signedText, timeText, weekdayText } from './phone-format';

describe('phone wording', () => {
  it('writes the day line Paper draws', () => {
    expect(dayText('2026-10-07')).toBe('Wed 7 Oct');
    expect(dayLine('Barista', '2026-10-07', 'DAY-NYR-0044')).toBe('Barista · Wed 7 Oct · DAY-NYR-0044');
  });
  it('reads times in Nairobi', () => {
    expect(timeText('2026-10-07T16:52:00.000Z')).toBe('7:52 pm');
    expect(weekdayText('2026-10-06T16:31:00.000Z')).toBe('Tuesday');
  });
  it('words a difference against last night', () => {
    expect(differenceText('-1')).toBe('1 less than last night');
    expect(differenceText('2.5')).toBe('2.5 more than last night');
    expect(signedText('-1')).toBe('−1');
    expect(signedText('3')).toBe('+3');
  });
  it('titles the signer by head or member', () => {
    expect(signedByText('Barista', true)).toBe('Barista Department Head');
    expect(signedByText('Barista', false)).toBe('Barista Member');
  });
  it('pluralises', () => {
    expect(plural(1, 'item', 'items')).toBe('1 item');
    expect(plural(8, 'item', 'items')).toBe('8 items');
  });
});
