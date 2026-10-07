import { Prisma, type PrepRunStatus } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { prepRunInclude, type PrepRunRow } from '../_shared/prep-run-repository';

/**
 * Reads and the one write of the review sub-module. Every query starts from `siteId`. "Needs a look" is a RECORDED run with
 * `needsLook` set: a cancelled run and a corrected original are out of the queue even if they were flagged before.
 */

const needsLookWhere = (siteId: string): Prisma.PrepRunWhereInput => ({ siteId, needsLook: true, status: 'RECORDED' });

export type ExportFilters = {
  search?: string;
  outputItemId?: string;
  personId?: string;
  status?: PrepRunStatus;
  needsLook?: boolean;
  mineUserId?: string;
  from?: Date;
  to?: Date;
};

const exportWhere = (siteId: string, filters: ExportFilters): Prisma.PrepRunWhereInput => ({
  siteId,
  ...(filters.outputItemId ? { outputItemId: filters.outputItemId } : {}),
  ...(filters.personId ? { createdById: filters.personId } : {}),
  ...(filters.mineUserId ? { createdById: filters.mineUserId } : {}),
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.needsLook !== undefined ? { needsLook: filters.needsLook } : {}),
  ...(filters.search
    ? {
        OR: [
          { reference: { contains: filters.search, mode: 'insensitive' } },
          { outputItem: { name: { contains: filters.search, mode: 'insensitive' } } },
          { createdBy: { name: { contains: filters.search, mode: 'insensitive' } } },
        ],
      }
    : {}),
  ...(filters.from || filters.to
    ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lt: filters.to } : {}) } }
    : {}),
});

export const reviewRepository = {
  listNeedsLook: (siteId: string, page: number, perPage: number): Promise<PrepRunRow[]> =>
    prisma.prepRun.findMany({
      where: needsLookWhere(siteId),
      include: prepRunInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),

  /** The sidebar badge: one indexed count on `(site, needs_look)`. */
  countNeedsLook: (siteId: string): Promise<number> => prisma.prepRun.count({ where: needsLookWhere(siteId) }),

  /** Locks nothing: the update is conditional on the run still being unreviewed, so a double click reviews once. */
  markReviewed: async (siteId: string, id: string, reviewerId: string, at: Date): Promise<boolean> => {
    const result = await prisma.prepRun.updateMany({
      where: { id, siteId, status: 'RECORDED', reviewedAt: null },
      data: { reviewedAt: at, reviewedById: reviewerId, needsLook: false },
    });
    return result.count > 0;
  },

  /** Newest first, one more than the cap so the service can tell "exactly the cap" from "over it". */
  exportRows: (siteId: string, filters: ExportFilters, take: number): Promise<PrepRunRow[]> =>
    prisma.prepRun.findMany({
      where: exportWhere(siteId, filters),
      include: prepRunInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    }),
};
