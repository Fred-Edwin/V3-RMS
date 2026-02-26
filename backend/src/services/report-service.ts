import type { Request } from 'express';
import { reportRepository } from '../repositories/report-repository';
import { redisClient } from '../config/redis';
import { ForbiddenError, ValidationError } from '../utils/errors';
import { formatDateOnly, parseDateOnly } from '../utils/date-only';
import { toCsv, toPdf } from '../utils/report-formatters';
import type {
  BranchTrendsReport,
  BranchOverviewReport,
  DailySummaryReport,
  DirectorTrendsReport,
  MyPerformanceReport,
  ReportType,
  StaffPerformanceReport,
} from '../types/report.types';
import type {
  BranchTrendsQueryInput,
  BranchOverviewQueryInput,
  DailySummaryQueryInput,
  DirectorTrendsQueryInput,
  ExportQueryInput,
  MyPerformanceQueryInput,
  StaffPerformanceQueryInput,
} from '../validators/report-schemas';

type Actor = NonNullable<Request['user']>;

const nairobiDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Nairobi',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getNairobiDateString = (date: Date = new Date()): string => {
  const parts = nairobiDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to format Nairobi date');
  }

  return `${year}-${month}-${day}`;
};

const isTodayInNairobi = (date: Date): boolean => {
  return formatDateOnly(date) === getNairobiDateString();
};

const resolveBranchScopedOrganizationId = (
  actor: Actor,
  requestedOrganizationId?: string,
): string => {
  if (actor.role === 'DIRECTOR') {
    if (!requestedOrganizationId) {
      throw new ValidationError('organizationId query param is required for directors');
    }

    return requestedOrganizationId;
  }

  if (!actor.organizationId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.organizationId;
};

const ensureValidRange = (startDate: string, endDate: string): { start: Date; end: Date } => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (start > end) {
    throw new ValidationError('startDate must be earlier than or equal to endDate');
  }

  return { start, end };
};

export const buildDailySummaryCacheKey = (organizationId: string, date: string): string => {
  return `report:daily:${organizationId}:${date}`;
};

interface CachedDailySummaryValue {
  cachedAt: string;
  data: DailySummaryReport;
}

const getCachedDailySummary = async (
  cacheKey: string,
): Promise<{ summary: DailySummaryReport; cachedAt: Date } | null> => {
  const cached = await redisClient.get(cacheKey);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached) as Partial<CachedDailySummaryValue>;
    if (
      typeof parsed.cachedAt !== 'string' ||
      typeof parsed.data !== 'object' ||
      parsed.data === null
    ) {
      return null;
    }

    const cachedAt = new Date(parsed.cachedAt);
    if (Number.isNaN(cachedAt.getTime())) {
      return null;
    }

    return {
      summary: parsed.data as DailySummaryReport,
      cachedAt,
    };
  } catch {
    return null;
  }
};

const cacheDailySummary = async (
  cacheKey: string,
  summary: DailySummaryReport,
  ttlSeconds: number,
): Promise<void> => {
  const payload: CachedDailySummaryValue = {
    cachedAt: new Date().toISOString(),
    data: summary,
  };

  await redisClient.setex(cacheKey, ttlSeconds, JSON.stringify(payload));
};

const fetchDailySummary = async (
  organizationId: string,
  date: Date,
  options?: {
    useCache?: boolean;
    cacheTtlSeconds?: number;
    maxCacheAgeMs?: number;
  },
): Promise<DailySummaryReport> => {
  const dateString = formatDateOnly(date);
  const cacheKey = buildDailySummaryCacheKey(organizationId, dateString);
  const shouldUseCache = options?.useCache ?? false;

  if (shouldUseCache) {
    const cached = await getCachedDailySummary(cacheKey);
    if (cached) {
      if (!options?.maxCacheAgeMs) {
        return cached.summary;
      }

      const ageMs = Date.now() - cached.cachedAt.getTime();
      if (ageMs <= options.maxCacheAgeMs) {
        return cached.summary;
      }
    }
  }

  const summary = await reportRepository.getDailySummaryByDate(organizationId, date);

  if (shouldUseCache || options?.cacheTtlSeconds) {
    await cacheDailySummary(cacheKey, summary, options?.cacheTtlSeconds ?? 86_400);
  }

  return summary;
};

export const reportService = {
  getDailySummary: async (
    actor: Actor,
    query: DailySummaryQueryInput,
  ): Promise<DailySummaryReport> => {
    const organizationId = resolveBranchScopedOrganizationId(actor, query.organizationId);
    const date = query.date ? parseDateOnly(query.date) : parseDateOnly(getNairobiDateString());

    return fetchDailySummary(organizationId, date, {
      useCache: isTodayInNairobi(date),
      cacheTtlSeconds: 86_400,
      maxCacheAgeMs: 60_000,
    });
  },

  getStaffPerformance: async (
    actor: Actor,
    query: StaffPerformanceQueryInput,
  ): Promise<StaffPerformanceReport> => {
    const organizationId = resolveBranchScopedOrganizationId(actor, query.organizationId);
    const { start, end } = ensureValidRange(query.startDate, query.endDate);

    return reportRepository.getStaffPerformance(organizationId, start, end, query.role);
  },

  getBranchOverview: async (
    actor: Actor,
    query: BranchOverviewQueryInput,
  ): Promise<BranchOverviewReport> => {
    if (actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only directors can access branch overview reports');
    }

    const { start, end } = ensureValidRange(query.startDate, query.endDate);
    return reportRepository.getBranchOverview(start, end);
  },

  getBranchTrends: async (
    actor: Actor,
    query: BranchTrendsQueryInput,
  ): Promise<BranchTrendsReport> => {
    const organizationId = resolveBranchScopedOrganizationId(actor, query.organizationId);
    const { start, end } = ensureValidRange(query.startDate, query.endDate);
    return reportRepository.getBranchTrends(organizationId, start, end);
  },

  getDirectorTrends: async (
    actor: Actor,
    query: DirectorTrendsQueryInput,
  ): Promise<DirectorTrendsReport> => {
    if (actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only directors can access trend analytics reports');
    }

    const { start, end } = ensureValidRange(query.startDate, query.endDate);
    return reportRepository.getDirectorTrends(start, end);
  },

  getMyPerformance: async (
    actor: Actor,
    query: MyPerformanceQueryInput,
  ): Promise<MyPerformanceReport> => {
    if (actor.role !== 'WAITER' && actor.role !== 'CHEF' && actor.role !== 'BARISTA') {
      throw new ForbiddenError('Only operational staff can access personal performance reports');
    }

    if (!actor.organizationId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    const { start, end } = ensureValidRange(query.startDate, query.endDate);

    return reportRepository.getMyPerformance(actor.id, actor.organizationId, actor.role, start, end);
  },

  exportReport: async (
    actor: Actor,
    query: ExportQueryInput,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> => {
    const { start, end } = ensureValidRange(query.startDate, query.endDate);

    let reportData: DailySummaryReport | StaffPerformanceReport | BranchOverviewReport;
    let filenameStem: string;

    if (query.reportType === 'daily_summary') {
      if (query.startDate !== query.endDate) {
        throw new ValidationError('daily_summary export requires startDate and endDate to match');
      }

      const dailySummary = await reportService.getDailySummary(actor, {
        date: query.startDate,
        organizationId: query.organizationId,
      });
      reportData = dailySummary;
      filenameStem = `daily-summary-${query.startDate}`;
    } else if (query.reportType === 'staff_performance') {
      const staffReport = await reportService.getStaffPerformance(actor, {
        startDate: query.startDate,
        endDate: query.endDate,
        organizationId: query.organizationId,
        role: undefined,
      });
      reportData = staffReport;
      filenameStem = `staff-performance-${query.startDate}-to-${query.endDate}`;
    } else {
      if (actor.role !== 'DIRECTOR') {
        throw new ForbiddenError('Only directors can export branch overview reports');
      }

      const branchOverview = await reportRepository.getBranchOverview(start, end);
      reportData = branchOverview;
      filenameStem = `branch-overview-${query.startDate}-to-${query.endDate}`;
    }

    const reportType = query.reportType as ReportType;
    const buffer =
      query.format === 'csv'
        ? toCsv(reportType, reportData)
        : await toPdf(reportType, reportData);

    return {
      buffer,
      filename: `${filenameStem}.${query.format}`,
      contentType: query.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
    };
  },

  precomputeDailySummaryForOrganization: async (
    organizationId: string,
    date: Date,
    cacheTtlSeconds: number,
  ): Promise<DailySummaryReport> => {
    return fetchDailySummary(organizationId, date, {
      useCache: false,
      cacheTtlSeconds,
    });
  },
};

