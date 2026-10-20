import { describe, expect, it } from 'vitest';
import { datesNamedInText } from './named-dates';

describe('datesNamedInText', () => {
  it('finds the days named before the notice month', () => {
    expect(datesNamedInText('On 9 and 23 September the bus broke down. I told my head at the time.', '2026-09')).toEqual(['2026-09-09', '2026-09-23']);
    expect(datesNamedInText('the 2nd, 9th and 16th of Sept were my fault', '2026-09')).toEqual(['2026-09-02', '2026-09-09', '2026-09-16']);
    expect(datesNamedInText('I was ill on 30 sep', '2026-09')).toEqual(['2026-09-30']);
  });

  it('never matches a number that is not before the month name', () => {
    expect(datesNamedInText('I was 5 minutes late twice and the bus took 40 minutes', '2026-09')).toEqual([]);
    expect(datesNamedInText('Mid September things changed', '2026-09')).toEqual([]);
  });

  it('ignores days of another month and invalid days', () => {
    expect(datesNamedInText('On 9 October the bus broke down', '2026-09')).toEqual([]);
    expect(datesNamedInText('On 45 September', '2026-09')).toEqual([]);
  });
});
