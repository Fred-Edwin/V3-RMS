import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAttendanceSummary,
  getHrDashboardStats,
  getStaffAttendanceDetail,
  getStaffOnLeaveToday,
} from './hr-repository';

const mocks = vi.hoisted(() => ({
  assignmentFindMany: vi.fn(),
  leaveFindMany: vi.fn(),
  leaveCount: vi.fn(),
}));

vi.mock('../config/database', () => ({
  prisma: {
    shiftAssignment: { findMany: mocks.assignmentFindMany },
    leaveRequest: { findMany: mocks.leaveFindMany, count: mocks.leaveCount },
    employeeProfile: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    disciplinaryRecord: { count: vi.fn().mockResolvedValue(0) },
    $transaction: async (calls: Array<Promise<unknown>>) => Promise.all(calls),
  },
}));

// Shift dates are @db.Date values: UTC midnight whose calendar day is the Nairobi date.
// Clock-in instants below are written in UTC; the comment gives the Nairobi (UTC+3) clock.
const assignment = (date: string, startTime: string, clockInAt: string | null) => ({
  userId: 'u1',
  siteId: 's1',
  date: new Date(`${date}T00:00:00.000Z`),
  shift: { id: 'sh1', name: 'Shift', startTime, endTime: '17:00' },
  clockRecord: clockInAt ? { clockInAt: new Date(clockInAt), clockOutAt: null } : null,
  user: { name: 'Amina', role: 'WAITER', site: { name: 'Nyeri Town' } },
});

const range = [new Date('2026-09-01T00:00:00.000Z'), new Date('2026-11-30T00:00:00.000Z')] as const;

const detailOf = async (date: string, startTime: string, clockInAt: string) => {
  mocks.assignmentFindMany.mockResolvedValue([assignment(date, startTime, clockInAt)]);
  const [day] = await getStaffAttendanceDetail('u1', range[0], range[1]);
  return day!;
};

const summaryOf = async (date: string, startTime: string, clockInAt: string) => {
  mocks.assignmentFindMany.mockResolvedValue([assignment(date, startTime, clockInAt)]);
  const [row] = await getAttendanceSummary(range[0], range[1]);
  return row!;
};

describe('legacy attendance reports use Nairobi time, whatever the server zone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('06:20 Nairobi clock-in for a 06:00 shift', () => {
    const clockIn = '2026-10-14T03:20:00.000Z'; // 06:20 Nairobi

    it('is 20 minutes late (detail)', async () => {
      const day = await detailOf('2026-10-14', '06:00', clockIn);
      expect(day.minutesLate).toBe(20);
      expect(day.status).toBe('LATE');
    });

    it('counts as late (summary)', async () => {
      expect((await summaryOf('2026-10-14', '06:00', clockIn)).late).toBe(1);
    });
  });

  describe('09:20 Nairobi clock-in for a 06:00 shift', () => {
    const clockIn = '2026-10-14T06:20:00.000Z'; // 09:20 Nairobi

    it('is 200 minutes late, not 20 (detail)', async () => {
      const day = await detailOf('2026-10-14', '06:00', clockIn);
      expect(day.minutesLate).toBe(200);
      expect(day.status).toBe('LATE');
    });

    it('counts as late (summary)', async () => {
      expect((await summaryOf('2026-10-14', '06:00', clockIn)).late).toBe(1);
    });
  });

  describe('on time and early', () => {
    it('06:10 is present, 10 minutes late, inside the 15 minute window', async () => {
      const day = await detailOf('2026-10-14', '06:00', '2026-10-14T03:10:00.000Z');
      expect(day).toMatchObject({ minutesLate: 10, status: 'PRESENT' });
    });

    it('05:50 is present with 0 minutes late', async () => {
      const day = await detailOf('2026-10-14', '06:00', '2026-10-14T02:50:00.000Z');
      expect(day).toMatchObject({ minutesLate: 0, status: 'PRESENT' });
      expect((await summaryOf('2026-10-14', '06:00', '2026-10-14T02:50:00.000Z')).late).toBe(0);
    });
  });

  describe('near Nairobi midnight', () => {
    it('00:50 Nairobi for a 00:30 shift is 20 late (UTC day is still the 13th)', async () => {
      const day = await detailOf('2026-10-14', '00:30', '2026-10-13T21:50:00.000Z');
      expect(day.minutesLate).toBe(20);
      expect(day.status).toBe('LATE');
    });

    it('23:50 Nairobi for a 23:30 shift is 20 late', async () => {
      const day = await detailOf('2026-10-14', '23:30', '2026-10-14T20:50:00.000Z');
      expect(day.minutesLate).toBe(20);
      expect(day.status).toBe('LATE');
    });

    it('summary agrees at both edges', async () => {
      expect((await summaryOf('2026-10-14', '00:30', '2026-10-13T21:50:00.000Z')).late).toBe(1);
      expect((await summaryOf('2026-10-14', '23:30', '2026-10-14T20:50:00.000Z')).late).toBe(1);
    });
  });

  describe('a shift on the 1st of a month', () => {
    it('06:20 Nairobi on 1 November is 20 late', async () => {
      const day = await detailOf('2026-11-01', '06:00', '2026-11-01T03:20:00.000Z');
      expect(day).toMatchObject({ date: '2026-11-01', minutesLate: 20, status: 'LATE' });
    });

    it('00:20 Nairobi on 1 October (still 30 September in UTC) is 20 late', async () => {
      const day = await detailOf('2026-10-01', '00:00', '2026-09-30T21:20:00.000Z');
      expect(day).toMatchObject({ date: '2026-10-01', minutesLate: 20, status: 'LATE' });
      expect((await summaryOf('2026-10-01', '00:00', '2026-09-30T21:20:00.000Z')).late).toBe(1);
    });
  });
});

describe('legacy HR "today" is the Nairobi day', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.leaveFindMany.mockResolvedValue([]);
    mocks.leaveCount.mockResolvedValue(0);
    // 01:30 on 15 October in Nairobi, still 14 October in UTC and Los Angeles
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T22:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('staff on leave today asks for 15 October', async () => {
    await getStaffOnLeaveToday();
    const where = mocks.leaveFindMany.mock.calls[0]![0].where;
    expect(where.startDate.lte).toEqual(new Date('2026-10-15T00:00:00.000Z'));
    expect(where.endDate.gte).toEqual(new Date('2026-10-15T00:00:00.000Z'));
  });

  it('dashboard on-leave count asks for 15 October', async () => {
    await getHrDashboardStats();
    const where = mocks.leaveCount.mock.calls[0]![0].where;
    expect(where.startDate.lte).toEqual(new Date('2026-10-15T00:00:00.000Z'));
    expect(where.endDate.gte).toEqual(new Date('2026-10-15T00:00:00.000Z'));
  });
});
