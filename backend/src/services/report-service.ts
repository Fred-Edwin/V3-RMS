import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { reportRepository } from '../repositories/report-repository';
import { branchRepository } from '../repositories/branch-repository';
import { corporateAccountRepository } from '../repositories/corporate-account-repository';
import { redisClient } from '../config/redis';
import { ForbiddenError, ValidationError } from '../utils/errors';
import { fromWire } from '../shared/utils/wire-names';
import { formatDateOnly, getTodayDateOnly, parseDateOnly } from '../utils/date-only';
import { toCsv, toPdf } from '../utils/report-formatters';
import type {
  AccountantReconciliationReport,
  BranchTrendsReport,
  BranchOverviewReport,
  CorporateAccountStatementReport,
  DailySummaryReport,
  DirectorPulseReport,
  DirectorTrendsReport,
  DiscountUsageReport,
  HourlyHeatmapReport,
  ItemsPerformanceReport,
  MyPerformanceReport,
  MyWaiterLiabilityReport,
  OutstandingBalancesReport,
  ReportType,
  StaffPerformanceReport,
  StaleOrdersReport,
  WaiterLiabilityOrder,
  WaiterLiabilitySummaryReport,
  WaiterLiabilitySummaryRow,
} from '../types/report.types';
import type {
  AccountantReconciliationQueryInput,
  BranchTrendsQueryInput,
  BranchOverviewQueryInput,
  DailySummaryQueryInput,
  DirectorTrendsQueryInput,
  DiscountUsageQueryInput,
  ExportQueryInput,
  HourlyHeatmapQueryInput,
  ItemsPerformanceQueryInput,
  MyPerformanceQueryInput,
  StaffPerformanceQueryInput,
  StaleOrdersQueryInput,
  WaiterLiabilitySummaryQueryInput,
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

const resolveBranchScopedSiteId = (
  actor: Actor,
  requestedSiteId?: string,
): string => {
  if (actor.role === 'DIRECTOR' || actor.role === 'ACCOUNTANT') {
    if (!requestedSiteId) {
      throw new ValidationError('organizationId query param is required for this role');
    }

    return requestedSiteId;
  }

  if (!actor.siteId) {
    throw new ForbiddenError('Branch context missing for this user');
  }

  return actor.siteId;
};

const ensureValidRange = (startDate: string, endDate: string): { start: Date; end: Date } => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);

  if (start > end) {
    throw new ValidationError('startDate must be earlier than or equal to endDate');
  }

  return { start, end };
};

export const buildDailySummaryCacheKey = (siteId: string, date: string): string => {
  return `report:daily:${siteId}:${date}`;
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
      // Entries cached before the Organization -> Site rename carry the old key names.
      summary: fromWire(parsed.data) as DailySummaryReport,
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
  siteId: string,
  date: Date,
  options?: {
    useCache?: boolean;
    cacheTtlSeconds?: number;
    maxCacheAgeMs?: number;
  },
): Promise<DailySummaryReport> => {
  const dateString = formatDateOnly(date);
  const cacheKey = buildDailySummaryCacheKey(siteId, dateString);
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

  const summary = await reportRepository.getDailySummaryByDate(siteId, date);

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
    const siteId = resolveBranchScopedSiteId(actor, query.siteId);
    const date = query.date ? parseDateOnly(query.date) : parseDateOnly(getNairobiDateString());

    return fetchDailySummary(siteId, date, {
      useCache: isTodayInNairobi(date),
      cacheTtlSeconds: 86_400,
      maxCacheAgeMs: 60_000,
    });
  },

  getStaffPerformance: async (
    actor: Actor,
    query: StaffPerformanceQueryInput,
  ): Promise<StaffPerformanceReport> => {
    const siteId = resolveBranchScopedSiteId(actor, query.siteId);
    const { start, end } = ensureValidRange(query.startDate, query.endDate);

    return reportRepository.getStaffPerformance(siteId, start, end, query.role);
  },

  getBranchOverview: async (
    actor: Actor,
    query: BranchOverviewQueryInput,
  ): Promise<BranchOverviewReport> => {
    if (actor.role !== 'DIRECTOR' && actor.role !== 'ACCOUNTANT') {
      throw new ForbiddenError('Only directors can access branch overview reports');
    }

    const { start, end } = ensureValidRange(query.startDate, query.endDate);
    return reportRepository.getBranchOverview(start, end);
  },

  getBranchTrends: async (
    actor: Actor,
    query: BranchTrendsQueryInput,
  ): Promise<BranchTrendsReport> => {
    const siteId = resolveBranchScopedSiteId(actor, query.siteId);
    const { start, end } = ensureValidRange(query.startDate, query.endDate);
    return reportRepository.getBranchTrends(siteId, start, end);
  },

  getDirectorTrends: async (
    actor: Actor,
    query: DirectorTrendsQueryInput,
  ): Promise<DirectorTrendsReport> => {
    if (actor.role !== 'DIRECTOR' && actor.role !== 'ACCOUNTANT') {
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

    if (!actor.siteId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    const { start, end } = ensureValidRange(query.startDate, query.endDate);

    return reportRepository.getMyPerformance(actor.id, actor.siteId, actor.role, start, end);
  },

  exportReport: async (
    actor: Actor,
    query: ExportQueryInput,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> => {
    const { start, end } = ensureValidRange(query.startDate, query.endDate);

    let reportData:
      | DailySummaryReport
      | StaffPerformanceReport
      | BranchOverviewReport
      | AccountantReconciliationReport
      | CorporateAccountStatementReport;
    let filenameStem: string;

    if (query.reportType === 'daily_summary') {
      if (query.startDate !== query.endDate) {
        throw new ValidationError('daily_summary export requires startDate and endDate to match');
      }
      const dailySummary = await reportService.getDailySummary(actor, {
        date: query.startDate,
        siteId: query.siteId,
      });
      reportData = dailySummary;
      filenameStem = `daily-summary-${query.startDate}`;
    } else if (query.reportType === 'staff_performance' || query.reportType === 'manager_analytics') {
      const staffReport = await reportService.getStaffPerformance(actor, {
        startDate: query.startDate,
        endDate: query.endDate,
        siteId: query.siteId,
        role: undefined,
      });
      reportData = staffReport;
      filenameStem = `${query.reportType === 'manager_analytics' ? 'branch-analytics' : 'staff-performance'}-${query.startDate}-to-${query.endDate}`;
    } else if (query.reportType === 'branch_overview' || query.reportType === 'director_analytics') {
      if (actor.role !== 'DIRECTOR' && actor.role !== 'ACCOUNTANT') {
        throw new ForbiddenError('Only directors can export branch overview reports');
      }
      const branchOverview = await reportRepository.getBranchOverview(start, end);
      reportData = branchOverview;
      filenameStem = `${query.reportType === 'director_analytics' ? 'director-analytics' : 'branch-overview'}-${query.startDate}-to-${query.endDate}`;
    } else if (query.reportType === 'accountant_reconciliation') {
      // accountant_reconciliation — uses startDate as the date
      if (actor.role !== 'DIRECTOR' && actor.role !== 'ACCOUNTANT') {
        throw new ForbiddenError('Only accountants and directors can export reconciliation reports');
      }
      if (!query.siteId) {
        throw new ValidationError('organizationId is required for reconciliation export');
      }
      const reconciliation = await reportRepository.getAccountantReconciliation(
        query.siteId,
        parseDateOnly(query.startDate),
      );
      reportData = reconciliation;
      filenameStem = `reconciliation-${query.startDate}`;
    } else {
      // corporate_account_statement — scoped by corporateAccountId, not organizationId
      if (actor.role !== 'DIRECTOR' && actor.role !== 'ACCOUNTANT') {
        throw new ForbiddenError('Only accountants and directors can export corporate account statements');
      }
      if (!query.corporateAccountId) {
        throw new ValidationError('corporateAccountId is required for corporate_account_statement export');
      }
      const account = await corporateAccountRepository.findById(query.corporateAccountId);
      if (!account) {
        throw new ValidationError('Corporate account not found');
      }
      const dateRange = { startDate: start, endDate: end };
      const [{ orders }, { settlements }, openingBalance] = await Promise.all([
        corporateAccountRepository.findOrdersByAccountId(query.corporateAccountId, 1, 10000, dateRange),
        corporateAccountRepository.findSettlementsByAccountId(query.corporateAccountId, 1, 10000, dateRange),
        corporateAccountRepository.getBalanceBefore(query.corporateAccountId, start),
      ]);

      const siteIds = [...new Set(orders.map((o) => o.siteId))];
      const sites = await Promise.all(siteIds.map((id) => branchRepository.findById(id)));
      const branchNameById = new Map(sites.filter((o) => !!o).map((o) => [o!.id, o!.name]));

      const totalCharged = orders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalSettled = settlements.reduce((sum, s) => sum + Number(s.amount), 0);
      const openingBalanceNum = Number(openingBalance);
      const closingBalance = openingBalanceNum + totalCharged - totalSettled;

      const today = getTodayDateOnly();
      const dueDate = new Date(today);
      dueDate.setUTCDate(dueDate.getUTCDate() + 14);
      const statementReference = `STMT-${account.companyName.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase().slice(0, 12)}-${query.startDate.replace(/-/g, '')}-${query.endDate.replace(/-/g, '')}`;

      reportData = {
        statementReference,
        statementDate: formatDateOnly(today),
        dueDate: formatDateOnly(dueDate),
        companyName: account.companyName,
        contactName: account.contactName,
        contactPhone: account.contactPhone,
        contactEmail: account.contactEmail,
        startDate: query.startDate,
        endDate: query.endDate,
        openingBalance: openingBalanceNum.toFixed(2),
        orders: orders.map((o) => ({
          id: o.id,
          dailyNumber: o.dailyNumber,
          date: formatDateOnly(o.createdAt),
          employeeRef: o.corporateEmployeeRef,
          branchName: branchNameById.get(o.siteId) ?? 'Unknown branch',
          total: o.total.toString(),
        })),
        settlements: settlements.map((s) => ({
          id: s.id,
          date: formatDateOnly(s.createdAt),
          amount: s.amount.toString(),
          paymentMethod: s.paymentMethod,
          recordedBy: s.settledBy.name,
          note: s.note,
        })),
        totalCharged: totalCharged.toFixed(2),
        totalSettled: totalSettled.toFixed(2),
        closingBalance: closingBalance.toFixed(2),
      };
      filenameStem = `corporate-statement-${account.companyName.replace(/\s+/g, '-').toLowerCase()}-${query.startDate}-to-${query.endDate}`;
    }

    const reportType = query.reportType as ReportType;
    const buffer =
      query.format === 'csv'
        ? toCsv(reportType, reportData)
        : await toPdf(reportType, reportData as never);

    return {
      buffer,
      filename: `${filenameStem}.${query.format}`,
      contentType: query.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
    };
  },

  getHourlyHeatmap: async (
    actor: Actor,
    query: HourlyHeatmapQueryInput,
  ): Promise<HourlyHeatmapReport> => {
    const siteId = resolveBranchScopedSiteId(actor, query.siteId);
    const { start, end } = ensureValidRange(query.startDate, query.endDate);
    return reportRepository.getHourlyHeatmap(siteId, start, end);
  },

  getDirectorPulse: async (actor: Actor): Promise<DirectorPulseReport> => {
    if (actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Access restricted to directors');
    }

    return reportRepository.getDirectorPulse();
  },

  precomputeDailySummaryForSite: async (
    siteId: string,
    date: Date,
    cacheTtlSeconds: number,
  ): Promise<DailySummaryReport> => {
    return fetchDailySummary(siteId, date, {
      useCache: false,
      cacheTtlSeconds,
    });
  },

  getOutstandingBalances: async (actor: Request['user']): Promise<OutstandingBalancesReport> => {
    if (!actor) throw new ForbiddenError('Authentication required');

    // MANAGER sees only their branch customer credits; others see all
    const orgId = actor.role === 'MANAGER' ? (actor.siteId ?? undefined) : undefined;

    const { houseAccounts, corporateAccounts, customerCreditAccounts } =
      await reportRepository.getOutstandingBalances(orgId);

    const sumDecimals = (rows: { currentBalance: { toFixed: (n: number) => string } }[]): string => {
      const total = rows.reduce((sum, r) => sum + Number.parseFloat(r.currentBalance.toFixed(2)), 0);
      return total.toFixed(2);
    };

    const staffBenefitsTotal = sumDecimals(houseAccounts);
    const corporateTotal = sumDecimals(corporateAccounts);
    const creditTotal = sumDecimals(customerCreditAccounts);
    // grandTotal is AR only — house accounts are staff benefits, not receivables
    const grandTotal = (
      Number.parseFloat(corporateTotal) +
      Number.parseFloat(creditTotal)
    ).toFixed(2);

    return {
      staffBenefits: houseAccounts.map((a) => ({
        id: a.id,
        userId: a.userId,
        userName: a.user.name,
        userRole: a.user.role,
        currentBalance: a.currentBalance.toFixed(2),
        creditLimit: a.creditLimit ? a.creditLimit.toFixed(2) : null,
      })),
      corporateAccounts: corporateAccounts.map((a) => ({
        id: a.id,
        companyName: a.companyName,
        contactName: a.contactName,
        contactPhone: a.contactPhone,
        currentBalance: a.currentBalance.toFixed(2),
        creditLimit: a.creditLimit ? a.creditLimit.toFixed(2) : null,
      })),
      customerCreditAccounts: customerCreditAccounts.map((a) => ({
        id: a.id,
        siteId: a.siteId,
        siteName: a.site.name,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        currentBalance: a.currentBalance.toFixed(2),
        creditLimit: a.creditLimit.toFixed(2),
      })),
      totals: {
        staffBenefits: staffBenefitsTotal,
        corporateAccounts: corporateTotal,
        customerCreditAccounts: creditTotal,
        grandTotal,
      },
    };
  },

  getItemsPerformance: async (
    actor: Actor,
    query: ItemsPerformanceQueryInput,
  ): Promise<ItemsPerformanceReport> => {
    const { start, end } = ensureValidRange(query.startDate, query.endDate);

    // Directors/Accountants may omit organizationId to get cross-branch aggregation
    if (actor.role === 'DIRECTOR' || actor.role === 'ACCOUNTANT') {
      return reportRepository.getItemsPerformance(query.siteId ?? null, start, end, query.limit);
    }

    const siteId = resolveBranchScopedSiteId(actor, query.siteId);
    return reportRepository.getItemsPerformance(siteId, start, end, query.limit);
  },

  getAccountantReconciliation: async (
    actor: Actor,
    query: AccountantReconciliationQueryInput,
  ): Promise<AccountantReconciliationReport> => {
    if (actor.role !== 'ACCOUNTANT' && actor.role !== 'SYSTEM_ADMIN') {
      throw new ForbiddenError('Only accountants can access reconciliation reports');
    }
    const date = parseDateOnly(query.date);
    return reportRepository.getAccountantReconciliation(query.siteId, date);
  },

  getStaleOrders: async (
    actor: Actor,
    query: StaleOrdersQueryInput,
  ): Promise<StaleOrdersReport> => {
    if (actor.role !== 'ACCOUNTANT' && actor.role !== 'SYSTEM_ADMIN') {
      throw new ForbiddenError('Only accountants can access stale orders');
    }
    const startDate = query.startDate ? parseDateOnly(query.startDate) : undefined;
    const endDate = query.endDate ? parseDateOnly(query.endDate) : undefined;
    return reportRepository.getStaleOrders(query.siteId ?? null, startDate, endDate);
  },

  // WAITER self-service: the waiter's own unresolved stale-order liabilities + running total.
  // Scoped to the waiter's branch (from JWT) and to orders they created.
  getMyWaiterLiabilities: async (actor: Actor): Promise<MyWaiterLiabilityReport> => {
    if (actor.role !== 'WAITER') {
      throw new ForbiddenError('Only waiters can view their own order liabilities');
    }
    if (!actor.siteId) {
      throw new ForbiddenError('Branch context missing for this user');
    }

    const rows = await reportRepository.getWaiterStaleLiabilities([actor.siteId], actor.id);
    const total = rows.reduce((sum, row) => sum.add(row.total), new Prisma.Decimal(0));

    return {
      totalOrders: rows.length,
      totalLiability: total.toFixed(2),
      orders: rows.map((row) => ({
        id: row.id,
        dailyNumber: row.dailyNumber,
        status: row.status,
        orderDate: row.orderDate.toISOString(),
        tableNumber: row.tableNumber,
        total: row.total.toFixed(2),
        branchName: row.branchName,
      })),
    };
  },

  // HR/payroll view: per-waiter rollup of unresolved stale-order liabilities so HR can key
  // the amount into otherDeductions manually. Cross-branch roles see all active branches
  // unless a specific organizationId is passed.
  getWaiterLiabilitySummary: async (
    actor: Actor,
    query: WaiterLiabilitySummaryQueryInput,
  ): Promise<WaiterLiabilitySummaryReport> => {
    const crossBranchRoles = ['HR_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'];
    let siteIds: string[];

    if (crossBranchRoles.includes(actor.role)) {
      siteIds = query.siteId
        ? [query.siteId]
        : await branchRepository.findActiveIds();
    } else if (actor.role === 'MANAGER' || actor.role === 'ACCOUNTANT') {
      if (actor.role === 'ACCOUNTANT') {
        if (!query.siteId) {
          throw new ValidationError('organizationId query param is required for this role');
        }
        siteIds = [query.siteId];
      } else {
        if (!actor.siteId) {
          throw new ForbiddenError('Branch context missing for this user');
        }
        if (query.siteId && query.siteId !== actor.siteId) {
          throw new ForbiddenError('Cannot access liabilities for another branch');
        }
        siteIds = [actor.siteId];
      }
    } else {
      throw new ForbiddenError('You do not have permission to view waiter liabilities');
    }

    const rows = await reportRepository.getWaiterStaleLiabilities(siteIds);

    // Roll up per waiter, keeping each waiter's individual orders for the HR drill-down.
    const byWaiter = new Map<string, WaiterLiabilitySummaryRow & { runningTotal: Prisma.Decimal }>();
    let grandTotal = new Prisma.Decimal(0);

    for (const row of rows) {
      grandTotal = grandTotal.add(row.total);
      const order: WaiterLiabilityOrder = {
        id: row.id,
        dailyNumber: row.dailyNumber,
        status: row.status,
        orderDate: row.orderDate.toISOString(),
        tableNumber: row.tableNumber,
        total: row.total.toFixed(2),
        branchName: row.branchName,
      };
      const existing = byWaiter.get(row.waiterId);
      if (existing) {
        existing.orderCount += 1;
        existing.runningTotal = existing.runningTotal.add(row.total);
        existing.orders.push(order);
      } else {
        byWaiter.set(row.waiterId, {
          waiterId: row.waiterId,
          waiterName: row.waiterName,
          branchName: row.branchName,
          orderCount: 1,
          totalLiability: '0.00',
          runningTotal: row.total,
          orders: [order],
        });
      }
    }

    const waiters: WaiterLiabilitySummaryRow[] = Array.from(byWaiter.values())
      .map(({ runningTotal, ...rest }) => ({ ...rest, totalLiability: runningTotal.toFixed(2) }))
      .sort((a, b) => Number(b.totalLiability) - Number(a.totalLiability));

    return {
      totalWaiters: waiters.length,
      totalOrders: rows.length,
      totalLiability: grandTotal.toFixed(2),
      waiters,
    };
  },

  getDiscountUsage: async (
    actor: Actor,
    query: DiscountUsageQueryInput,
  ): Promise<DiscountUsageReport> => {
    if (actor.role !== 'DIRECTOR') {
      throw new ForbiddenError('Only directors can access discount usage reports');
    }
    const { start, end } = ensureValidRange(query.startDate, query.endDate);
    return reportRepository.getDiscountUsage(start, end, query.siteId);
  },
};

