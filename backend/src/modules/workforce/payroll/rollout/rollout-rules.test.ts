import { describe, expect, it, vi } from 'vitest';

vi.mock('./rollout-repository', () => ({ rolloutRepository: { coverage: vi.fn() } }));

import { rolloutRepository } from './rollout-repository';
import { isSitePeriodOnNewPayroll } from './rollout-guard';
import { coversPeriod, type SiteCoverage } from './rollout-rules';

const coverage = (over: Partial<SiteCoverage> = {}): SiteCoverage => ({ switchEnabled: false, switchEnabledAt: null, firstPayrollMonth: null, ...over });
// 2026-10-01 00:30 Nairobi is 2026-09-30 21:30 UTC: the Nairobi day is what counts.
const onTheFirst = new Date('2026-09-30T21:30:00Z');
const midMonth = new Date('2026-10-03T08:00:00Z');

describe('coversPeriod', () => {
  it('leaves a site that never switched to the old run, for every month', () => {
    expect(coversPeriod(coverage(), '2026-10')).toBe(false);
    expect(coversPeriod(coverage(), '2027-01')).toBe(false);
  });

  it('covers a month the switch was on for from its first day, even before it is calculated', () => {
    const c = coverage({ switchEnabled: true, switchEnabledAt: onTheFirst });
    expect(coversPeriod(c, '2026-10')).toBe(true); // Nairobi 1 Oct, though it is 30 Sep in UTC
    expect(coversPeriod(c, '2026-11')).toBe(true);
    expect(coversPeriod(c, '2026-09')).toBe(false); // history stays with the old run
  });

  it('a switch turned on mid-month starts with the first full month after', () => {
    const c = coverage({ switchEnabled: true, switchEnabledAt: midMonth });
    expect(coversPeriod(c, '2026-10')).toBe(false);
    expect(coversPeriod(c, '2026-11')).toBe(true);
  });

  it('a site that appeared in a payroll month never returns to the old run, even with the switch off', () => {
    const c = coverage({ switchEnabled: false, switchEnabledAt: midMonth, firstPayrollMonth: '2026-11' });
    expect(coversPeriod(c, '2026-11')).toBe(true);
    expect(coversPeriod(c, '2027-03')).toBe(true);
    expect(coversPeriod(c, '2026-10')).toBe(false); // before it joined, the old history is still the old run's
  });

  it('refuses nothing for a value that is not a pay period', () => {
    expect(coversPeriod(coverage({ firstPayrollMonth: '2026-01' }), '2026-13')).toBe(false);
    expect(coversPeriod(coverage({ firstPayrollMonth: '2026-01' }), 'September')).toBe(false);
  });
});

describe('isSitePeriodOnNewPayroll', () => {
  it('asks the repository and applies the rule', async () => {
    vi.mocked(rolloutRepository.coverage).mockResolvedValueOnce(coverage({ firstPayrollMonth: '2026-09' }));
    await expect(isSitePeriodOnNewPayroll('s1', '2026-09')).resolves.toBe(true);
    vi.mocked(rolloutRepository.coverage).mockResolvedValueOnce(coverage());
    await expect(isSitePeriodOnNewPayroll('s2', '2026-09')).resolves.toBe(false);
  });

  it('fails closed: an unreadable answer is an error, never "not covered"', async () => {
    vi.mocked(rolloutRepository.coverage).mockRejectedValueOnce(new Error('database down'));
    await expect(isSitePeriodOnNewPayroll('s1', '2026-09')).rejects.toThrow('database down');
  });
});
