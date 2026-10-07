import { prisma } from '../../../../config/database';

/** Counts for the manager's KPI strip. Only RECORDED runs count: a cancelled run was never made and a corrected original is replaced by its new run. */
export const runsSummaryRepository = {
  countRecordedSince: (siteId: string, since: Date): Promise<number> => prisma.prepRun.count({ where: { siteId, status: 'RECORDED', createdAt: { gte: since } } }),

  /** Total input cost of RECORDED runs since a moment, as a decimal string ("0" with none). */
  inputCostSince: async (siteId: string, since: Date): Promise<string> => {
    const sum = await prisma.prepRun.aggregate({ where: { siteId, status: 'RECORDED', createdAt: { gte: since } }, _sum: { totalInputCost: true } });
    return sum._sum.totalInputCost?.toFixed() ?? '0';
  },
};
