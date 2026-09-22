import { Prisma, type Discrepancy, type DiscrepancyOutcome } from '@prisma/client';
import { prisma } from '../../config/database';

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
      organizationId: string;
      toOrganizationId: string;
      toOrganization: { id: string; name: string };
      confirmedAt: Date | null;
      confirmedBy: { id: string; name: string } | null;
    };
  };
  resolvedBy: { id: string; name: string } | null;
};

export const discrepancyRepository = {
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
      where: { dispatchLine: { dispatch: { toOrganizationId: { in: branchOrgIds } } } },
      include: discrepancyDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  /** Branch Manager scope: this branch's discrepancies only, read-only. */
  findAllForBranch: async (toOrganizationId: string, limit: number): Promise<DiscrepancyWithDetail[]> => {
    return prisma.discrepancy.findMany({
      where: { dispatchLine: { dispatch: { toOrganizationId } } },
      include: discrepancyDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  findByIdForHub: async (id: string, branchOrgIds: string[]): Promise<DiscrepancyWithDetail | null> => {
    if (branchOrgIds.length === 0) return null;
    return prisma.discrepancy.findFirst({
      where: { id, dispatchLine: { dispatch: { toOrganizationId: { in: branchOrgIds } } } },
      include: discrepancyDetailInclude,
    });
  },

  findByIdForBranch: async (id: string, toOrganizationId: string): Promise<DiscrepancyWithDetail | null> => {
    return prisma.discrepancy.findFirst({
      where: { id, dispatchLine: { dispatch: { toOrganizationId } } },
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
          organizationId: true,
          toOrganizationId: true,
          toOrganization: { select: { id: true, name: true } },
          confirmedAt: true,
          confirmedBy: { select: { id: true, name: true } },
        },
      },
    },
  },
  resolvedBy: { select: { id: true, name: true } },
} satisfies Prisma.DiscrepancyInclude;
