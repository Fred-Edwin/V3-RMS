import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { countSettingsRepository, type CountSettingsRecord } from '../_shared/count-settings-repository';

export type { CountSettingsRecord };

/** One signed line of the last seven days, as the what-if preview needs it: the frozen figures only. */
export type SignedLineFigures = { countId: string; counted: Prisma.Decimal; expected: Prisma.Decimal; unitCost: Prisma.Decimal };

export const settingsRepository = {
  find: (siteId: string): Promise<CountSettingsRecord | null> => countSettingsRepository.find(siteId),

  /** The Store Manager's write: the range, the percent and the repeat switch. The Director's alert amount is left as it was. */
  saveRange: async (
    siteId: string,
    data: { rangeKes: number; rangePercent: Prisma.Decimal; flagRepeatShortfalls: boolean; updatedById: string },
  ): Promise<CountSettingsRecord> => {
    await prisma.countingThresholds.upsert({
      where: { siteId },
      create: {
        siteId,
        reasonRequiredKes: data.rangeKes,
        rangePercent: data.rangePercent,
        flagRepeatShortfalls: data.flagRepeatShortfalls,
        updatedById: data.updatedById,
      },
      update: {
        reasonRequiredKes: data.rangeKes,
        rangePercent: data.rangePercent,
        flagRepeatShortfalls: data.flagRepeatShortfalls,
        updatedById: data.updatedById,
      },
    });
    return (await countSettingsRepository.find(siteId))!;
  },

  /**
   * The Director's write: only the alert amount. `updatedAt` is passed back unchanged when the row exists, so "range updated at"
   * keeps meaning the last time the RANGE changed, not the last time anything on the row did.
   */
  saveDirectorAlert: async (siteId: string, data: { alertKes: number; updatedById: string; at: Date; keepRangeStamp: Date | null }): Promise<CountSettingsRecord> => {
    await prisma.countingThresholds.upsert({
      where: { siteId },
      create: { siteId, reasonRequiredKes: 500, directorAlertKes: data.alertKes, directorUpdatedById: data.updatedById, directorUpdatedAt: data.at },
      update: {
        directorAlertKes: data.alertKes,
        directorUpdatedById: data.updatedById,
        directorUpdatedAt: data.at,
        ...(data.keepRangeStamp ? { updatedAt: data.keepRangeStamp } : {}),
      },
    });
    return (await countSettingsRepository.find(siteId))!;
  },

  /** Every counted line of a signed count since `since`, with the figures frozen at the sign. */
  signedLinesSince: async (siteId: string, since: Date): Promise<SignedLineFigures[]> => {
    const rows = await prisma.countLine.findMany({
      where: {
        siteId,
        countedQty: { not: null },
        expectedQty: { not: null },
        unitCost: { not: null },
        count: { status: { in: ['SUBMITTED', 'APPROVED'] }, signedAt: { gte: since } },
      },
      select: { countId: true, countedQty: true, expectedQty: true, unitCost: true },
    });
    return rows.map((r) => ({ countId: r.countId, counted: r.countedQty!, expected: r.expectedQty!, unitCost: r.unitCost! }));
  },
};
