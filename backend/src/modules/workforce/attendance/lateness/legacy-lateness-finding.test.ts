import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeLateness } from '../../_shared/time/lateness';
import { instantAt, parseClockTime, parseNairobiDate } from '../../_shared/time/nairobi-time';

const findMany = vi.fn();
vi.mock('../../../../config/database', () => ({ prisma: { shiftAssignment: { findMany: (...args: unknown[]) => findMany(...args) } } }));

import { getStaffAttendanceDetail } from '../../../../repositories/hr-repository';

/**
 * FINDING (slice 3, 18 Oct 2026). The legacy attendance report (hr-repository.ts, getStaffAttendanceDetail and
 * getAttendanceSummary) measures lateness with `new Date(clockIn).setHours(h, m)`, which uses the SERVER's zone. Shift
 * times are Nairobi clock times and production runs in UTC, so on production the shift "starts" three hours late and
 * a person who clocks in at 06:20 for a 06:00 shift is never reported late. This test records what the legacy code
 * computes in each zone. It documents the bug; it does not fix it (the legacy code is untouched by this slice).
 */
const originalZone = process.env.TZ;
afterEach(() => {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

const DAY = parseNairobiDate('2026-10-12');
const SHIFT = { date: DAY, startTime: parseClockTime('06:00'), endTime: parseClockTime('14:00'), unpaidBreakMinutes: 0 };

async function legacyVerdict(zone: string, nairobiClock: string) {
  process.env.TZ = zone;
  const clockInAt = instantAt(DAY, parseClockTime(nairobiClock));
  findMany.mockResolvedValue([
    {
      date: new Date('2026-10-12T00:00:00.000Z'),
      shift: { id: 's1', name: 'Morning', startTime: '06:00', endTime: '14:00' },
      clockRecord: { clockInAt, clockOutAt: null },
    },
  ]);
  const [row] = await getStaffAttendanceDetail('u1', new Date('2026-10-12'), new Date('2026-10-12'));
  return { status: row?.status, minutesLate: row?.minutesLate };
}

describe('legacy lateness on a UTC server (production) against the Nairobi truth', () => {
  it('on a Nairobi-zone machine (a developer laptop) 06:20 for a 06:00 shift is 20 minutes late, which is why it looked right in testing', async () => {
    expect(await legacyVerdict('Africa/Nairobi', '06:20')).toEqual({ status: 'LATE', minutesLate: 20 });
  });

  it('on a UTC server a 06:20 clock-in is never reported late (the shift is read as 06:00 UTC, which is 09:00 in Nairobi)', async () => {
    const verdict = await legacyVerdict('UTC', '06:20');
    expect(verdict).toEqual({ status: 'PRESENT', minutesLate: 0 });
    expect(computeLateness(SHIFT, instantAt(DAY, parseClockTime('06:20')), { graceMinutes: 5 })).toMatchObject({ minutesLate: 20, countsAsLate: true });
  });

  it('on a UTC server only a clock-in about three hours after the real start is reported, and with the wrong minutes', async () => {
    const verdict = await legacyVerdict('UTC', '09:20');
    expect(verdict.minutesLate).toBe(20); // really 200 minutes late
    expect(computeLateness(SHIFT, instantAt(DAY, parseClockTime('09:20')), { graceMinutes: 5 }).minutesLate).toBe(200);
  });
});
