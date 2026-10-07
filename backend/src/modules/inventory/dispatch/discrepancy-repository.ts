import { Prisma, type Discrepancy, type DiscrepancyOutcome, type DiscrepancyStatus } from '@prisma/client';
import { prisma } from '../../../config/database';

type TxClient = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Discrepancy (Milestone Five, Session B). Automatic on a mismatched confirm
// (Flow 10a) — never created directly by a user action. Numbered via
// ReferenceCounter ('DSC', hub-scoped) — same mechanism as GRN/ADJ, per
// session-a-plan.md decision #1 / session-b-plan.md decision #1.
// ---------------------------------------------------------------------------

export type DiscrepancyWithDetail = Discrepancy & {
  dispatchLine: {
    id: string;
    dispatchedQty: Prisma.Decimal;
    confirmedQty: Prisma.Decimal | null;
    costAtDispatch: Prisma.Decimal;
    item: { id: string; name: string; usageUnit: string };
    dispatch: {
      id: string;
      sequenceLabel: string;
      departmentTag: string;
      siteId: string;
      toSiteId: string;
      toSite: { id: string; name: string };
      confirmedAt: Date | null;
      confirmedBy: { id: string; name: string } | null;
    };
  };
  resolvedBy: { id: string; name: string } | null;
};

export interface DiscrepancyListFilter {
  status?: DiscrepancyStatus;
  search?: string;
  /** Rows to skip and take; omit both for "the newest `take`" with no skipping. */
  skip: number;
  take: number;
}

/** Narrowing shared by both scopes: status, and a case-insensitive match on the DSC number, the item or the dispatch label. */
const narrowing = (f: DiscrepancyListFilter): Prisma.DiscrepancyWhereInput => ({
  ...(f.status ? { status: f.status } : {}),
  ...(f.search
    ? {
        OR: [
          { referenceNumber: { contains: f.search, mode: 'insensitive' } },
          { dispatchLine: { item: { name: { contains: f.search, mode: 'insensitive' } } } },
          { dispatchLine: { dispatch: { sequenceLabel: { contains: f.search, mode: 'insensitive' } } } },
        ],
      }
    : {}),
});

export const discrepancyRepository = {
  /** Store Manager scope, narrowed and paged, with the total of what matches (before paging). */
  pageForHub: async (branchOrgIds: string[], f: DiscrepancyListFilter): Promise<{ rows: DiscrepancyWithDetail[]; total: number }> => {
    if (branchOrgIds.length === 0) return { rows: [], total: 0 };
    const where: Prisma.DiscrepancyWhereInput = { dispatchLine: { dispatch: { toSiteId: { in: branchOrgIds } } }, ...narrowing(f) };
    const [rows, total] = await Promise.all([
      prisma.discrepancy.findMany({ where, include: discrepancyDetailInclude, orderBy: { createdAt: 'desc' }, skip: f.skip, take: f.take }),
      prisma.discrepancy.count({ where }),
    ]);
    return { rows, total };
  },

  /** Branch Manager scope (this branch's `toSiteId` only), narrowed and paged. */
  pageForBranch: async (toSiteId: string, f: DiscrepancyListFilter): Promise<{ rows: DiscrepancyWithDetail[]; total: number }> => {
    const where: Prisma.DiscrepancyWhereInput = { dispatchLine: { dispatch: { toSiteId } }, ...narrowing(f) };
    const [rows, total] = await Promise.all([
      prisma.discrepancy.findMany({ where, include: discrepancyDetailInclude, orderBy: { createdAt: 'desc' }, skip: f.skip, take: f.take }),
      prisma.discrepancy.count({ where }),
    ]);
    return { rows, total };
  },

  /** One row per mismatched line on a confirm (session-b-plan.md decision #2). Must run inside the confirm's own transaction. */
  createForLine: async (
    input: { dispatchLineId: string; referenceNumber: string; gapQty: Prisma.Decimal.Value },
    tx: TxClient,
  ): Promise<Discrepancy> => {
    return tx.discrepancy.create({
      data: {
        dispatchLineId: input.dispatchLineId,
        referenceNumber: input.referenceNumber,
        gapQty: input.gapQty,
        status: 'OPEN',
      },
    });
  },

  /** Store Manager scope: every OPEN/RESOLVED discrepancy across every branch, explicitly enumerated. */
  findAllForHub: async (branchOrgIds: string[], limit: number): Promise<DiscrepancyWithDetail[]> => {
    if (branchOrgIds.length === 0) return [];
    return prisma.discrepancy.findMany({
      where: { dispatchLine: { dispatch: { toSiteId: { in: branchOrgIds } } } },
      include: discrepancyDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  /** Branch Manager scope: this branch's discrepancies only, read-only. */
  findAllForBranch: async (toSiteId: string, limit: number): Promise<DiscrepancyWithDetail[]> => {
    return prisma.discrepancy.findMany({
      where: { dispatchLine: { dispatch: { toSiteId } } },
      include: discrepancyDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  findByIdForHub: async (id: string, branchOrgIds: string[]): Promise<DiscrepancyWithDetail | null> => {
    if (branchOrgIds.length === 0) return null;
    return prisma.discrepancy.findFirst({
      where: { id, dispatchLine: { dispatch: { toSiteId: { in: branchOrgIds } } } },
      include: discrepancyDetailInclude,
    });
  },

  findByIdForBranch: async (id: string, toSiteId: string): Promise<DiscrepancyWithDetail | null> => {
    return prisma.discrepancy.findFirst({
      where: { id, dispatchLine: { dispatch: { toSiteId } } },
      include: discrepancyDetailInclude,
    });
  },

  /**
   * Guarded resolve — same "no partial-signed state" pattern as
   * `dispatchRepository.markConfirmed`: `updateMany` with `status: 'OPEN'`
   * in the `where`, a `count === 0` means someone else resolved it first.
   */
  markResolved: async (
    id: string,
    tx: TxClient,
    data: {
      outcome: DiscrepancyOutcome;
      resolutionNote: string | null;
      resolvedById: string;
      resolvedAt: Date;
      followUpDispatchId?: string;
    },
  ): Promise<number> => {
    const updated = await tx.discrepancy.updateMany({
      where: { id, status: 'OPEN' },
      data: { ...data, status: 'RESOLVED' },
    });
    return updated.count;
  },

  /**
   * Flow 11 step 4: a DISCREPANCY_OPEN dispatch becomes CONFIRMED once none of
   * its lines has an OPEN discrepancy left. Runs inside the resolve transaction.
   */
  closeDispatchIfResolved: async (tx: TxClient, dispatchId: string): Promise<void> => {
    const stillOpen = await tx.discrepancy.count({
      where: { status: 'OPEN', dispatchLine: { dispatchId } },
    });
    if (stillOpen > 0) return;
    await tx.dispatch.updateMany({
      where: { id: dispatchId, status: 'DISCREPANCY_OPEN' },
      data: { status: 'CONFIRMED' },
    });
  },
};

const discrepancyDetailInclude = {
  dispatchLine: {
    select: {
      id: true,
      dispatchedQty: true,
      confirmedQty: true,
      costAtDispatch: true,
      item: { select: { id: true, name: true, usageUnit: true } },
      dispatch: {
        select: {
          id: true,
          sequenceLabel: true,
          departmentTag: true,
          siteId: true,
          toSiteId: true,
          toSite: { select: { id: true, name: true } },
          confirmedAt: true,
          confirmedBy: { select: { id: true, name: true } },
        },
      },
    },
  },
  resolvedBy: { select: { id: true, name: true } },
} satisfies Prisma.DiscrepancyInclude;
