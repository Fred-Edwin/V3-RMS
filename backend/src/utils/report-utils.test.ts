import { describe, expect, it } from 'vitest';
import {
  computeActualHours,
  computeAveragePrepMinutes,
  computeClosedOrderRevenue,
  computeScheduledHours,
} from './report-utils';

describe('report-utils', () => {
  it('computeAveragePrepMinutes returns rounded mean from valid timestamps', () => {
    const value = computeAveragePrepMinutes([
      {
        claimedAt: new Date('2026-02-24T08:00:00.000Z'),
        readyAt: new Date('2026-02-24T08:12:00.000Z'),
      },
      {
        claimedAt: new Date('2026-02-24T09:00:00.000Z'),
        readyAt: new Date('2026-02-24T09:18:00.000Z'),
      },
      {
        claimedAt: null,
        readyAt: new Date('2026-02-24T09:20:00.000Z'),
      },
    ]);

    expect(value).toBe(15);
  });

  it('computeActualHours excludes records without clockOutAt', () => {
    const value = computeActualHours([
      {
        clockInAt: new Date('2026-02-24T06:00:00.000Z'),
        clockOutAt: new Date('2026-02-24T14:00:00.000Z'),
      },
      {
        clockInAt: new Date('2026-02-24T15:00:00.000Z'),
        clockOutAt: null,
      },
      {
        clockInAt: new Date('2026-02-24T16:00:00.000Z'),
        clockOutAt: new Date('2026-02-24T18:30:00.000Z'),
      },
    ]);

    expect(value).toBe(10.5);
  });

  it('computeScheduledHours sums shift durations in decimal hours', () => {
    const value = computeScheduledHours([
      {
        shift: {
          startTime: '06:00',
          endTime: '14:00',
        },
      },
      {
        shift: {
          startTime: '15:00',
          endTime: '19:30',
        },
      },
    ]);

    expect(value).toBe(12.5);
  });

  it('computeClosedOrderRevenue sums closed totals and excludes cancelled', () => {
    const value = computeClosedOrderRevenue([
      {
        status: 'CLOSED',
        total: '1200.50',
      },
      {
        status: 'CANCELLED',
        total: '9999.99',
      },
      {
        status: 'CLOSED',
        total: '350.00',
      },
    ]);

    expect(value).toBe('1550.50');
  });
});

