import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redisClient } from '../config/redis';
import { reportRepository } from '../repositories/report-repository';
import { reportService } from './report-service';
import { ForbiddenError, ValidationError } from '../utils/errors';
import { toCsv, toPdf } from '../utils/report-formatters';

vi.mock('../config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
  },
}));

vi.mock('../repositories/report-repository', () => ({
  reportRepository: {
    getDailySummaryByDate: vi.fn(),
    getStaffPerformance: vi.fn(),
    getBranchOverview: vi.fn(),
    getBranchTrends: vi.fn(),
    getDirectorTrends: vi.fn(),
    getMyPerformance: vi.fn(),
    listActiveOrganizations: vi.fn(),
  },
}));

vi.mock('../utils/report-formatters', () => ({
  toCsv: vi.fn(),
  toPdf: vi.fn(),
}));

const managerActor = {
  id: 'manager-1',
  role: 'MANAGER',
  organizationId: 'org-1',
} as NonNullable<Request['user']>;

const directorActor = {
  id: 'director-1',
  role: 'DIRECTOR',
  organizationId: null,
} as NonNullable<Request['user']>;

const sampleDailySummary = {
  date: '2026-02-24',
  organizationId: 'org-1',
  organizationName: 'Wendo Kingz',
  totalRevenue: '1000.00',
  orderCount: 2,
  ordersByType: {
    DINE_IN: 1,
    TAKE_AWAY: 1,
    DELIVERY: 0,
  },
  revenueByPaymentMethod: {
    MPESA: '800.00',
    CASH: '200.00',
    CARD: '0.00',
  },
  topItems: [],
  averagePrepTimeMinutes: {
    KITCHEN: 10,
    BARISTA: 6,
  },
};

describe('reportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached daily summary for today', async () => {
    const todayNairobi = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .reduce(
        (acc, part) => {
          if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
            acc[part.type] = part.value;
          }
          return acc;
        },
        { year: '', month: '', day: '' },
      );

    const dateString = `${todayNairobi.year}-${todayNairobi.month}-${todayNairobi.day}`;

    vi.mocked(redisClient.get).mockResolvedValue(
      JSON.stringify({
        cachedAt: new Date().toISOString(),
        data: sampleDailySummary,
      }),
    );

    const result = await reportService.getDailySummary(managerActor, {
      date: dateString,
    });

    expect(result.totalRevenue).toBe('1000.00');
    expect(reportRepository.getDailySummaryByDate).not.toHaveBeenCalled();
  });

  it('computes and caches daily summary on cache miss', async () => {
    const todayNairobi = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .reduce(
        (acc, part) => {
          if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
            acc[part.type] = part.value;
          }
          return acc;
        },
        { year: '', month: '', day: '' },
      );

    const dateString = `${todayNairobi.year}-${todayNairobi.month}-${todayNairobi.day}`;

    vi.mocked(redisClient.get).mockResolvedValue(null);
    vi.mocked(reportRepository.getDailySummaryByDate).mockResolvedValue(sampleDailySummary);
    vi.mocked(redisClient.setex).mockResolvedValue('OK');

    const result = await reportService.getDailySummary(managerActor, {
      date: dateString,
    });

    expect(result.orderCount).toBe(2);
    expect(reportRepository.getDailySummaryByDate).toHaveBeenCalledTimes(1);
    expect(redisClient.setex).toHaveBeenCalledTimes(1);
  });

  it('requires organizationId for director branch-scoped staff performance', async () => {
    await expect(
      reportService.getStaffPerformance(directorActor, {
        startDate: '2026-02-01',
        endDate: '2026-02-24',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('manager branch scope ignores requested organizationId', async () => {
    vi.mocked(reportRepository.getDailySummaryByDate).mockResolvedValue(sampleDailySummary);

    await reportService.getDailySummary(managerActor, {
      date: '2026-02-01',
      organizationId: 'org-999',
    });

    expect(reportRepository.getDailySummaryByDate).toHaveBeenCalledWith('org-1', expect.any(Date));
  });

  it('blocks manager branch-overview access in service layer', async () => {
    await expect(
      reportService.getBranchOverview(managerActor, {
        startDate: '2026-02-01',
        endDate: '2026-02-24',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('requires organizationId for director branch-trends access', async () => {
    await expect(
      reportService.getBranchTrends(directorActor, {
        startDate: '2026-02-01',
        endDate: '2026-02-24',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('blocks manager director-trends access in service layer', async () => {
    await expect(
      reportService.getDirectorTrends(managerActor, {
        startDate: '2026-02-01',
        endDate: '2026-02-24',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('exportReport dispatches CSV formatter for staff performance', async () => {
    vi.mocked(reportRepository.getStaffPerformance).mockResolvedValue({
      period: {
        startDate: '2026-02-01',
        endDate: '2026-02-24',
      },
      organizationId: 'org-1',
      organizationName: 'Wendo Kingz',
      staff: [],
    });

    vi.mocked(toCsv).mockReturnValue(Buffer.from('csv-body', 'utf-8'));

    const result = await reportService.exportReport(managerActor, {
      reportType: 'staff_performance',
      format: 'csv',
      startDate: '2026-02-01',
      endDate: '2026-02-24',
    });

    expect(toCsv).toHaveBeenCalledTimes(1);
    expect(toPdf).not.toHaveBeenCalled();
    expect(result.contentType).toContain('text/csv');
    expect(result.filename).toContain('staff-performance');
  });
});

