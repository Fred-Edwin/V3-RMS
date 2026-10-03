import { Prisma, type Dispatch, type DispatchLine, type DispatchStatus, type DepartmentTag } from '@prisma/client';
import { prisma } from '../../../config/database';
import { getTodayNairobiRangeUtc } from '../../../utils/date-only';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Dispatch (Milestone Five, Session A). organizationId = hub org (Central
// Store owns the document), toOrganizationId = branch org — the StaffTransfer
// two-org pattern. The dispatch queue's cross-org read is the documented
// exception (CENTRAL_STORE_SCOPING_DESIGN.md §4): callers must pass an
// explicit branch-org id list, never an unscoped query.
// ---------------------------------------------------------------------------

export type DispatchQueueRequisition = {
  id: string;
  organizationId: string;
  type: string;
  openedAt: Date;
  toOrganization: { id: string; name: string };
  sections: {
    departmentTag: DepartmentTag;
    lines: { requestedQty: Prisma.Decimal | null; approvedQty: Prisma.Decimal | null }[];
  }[];
  dispatches: { departmentTag: DepartmentTag; status: DispatchStatus }[];
};

export type DispatchWithLines = Dispatch & {
  toOrganization: { id: string; name: string };
  dispatchedBy: { id: string; name: string } | null;
  confirmedBy: { id: string; name: string } | null;
  lines: (DispatchLine & { item: { id: string; name: string; usageUnit: string } })[];
};

export type RequisitionSectionForFulfil = {
  id: string;
  departmentTag: DepartmentTag;
  status: string;
  requisition: { id: string; organizationId: string; toOrganizationName: string } | null;
  lines: {
    id: string;
    inventoryItemId: string;
    requestedQty: Prisma.Decimal | null;
    approvedQty: Prisma.Decimal | null;
    item: { id: string; name: string; usageUnit: string; currentCost: Prisma.Decimal };
  }[];
};

export const dispatchRepository = {
  /**
   * Central Store queue: APPROVED requisitions across the given branch org
   * ids (explicit enumeration — never unscoped), with enough section/line
   * data for the service to compute per-department fulfil status. Existing
   * Dispatch rows are included so the service can mark a department
   * AWAITING/IN_TRANSIT/CONFIRMED/DISCREPANCY_OPEN vs. not-yet-dispatched.
   */
  findQueueByBranchOrgIds: async (branchOrgIds: string[], limit: number): Promise<DispatchQueueRequisition[]> => {
    if (branchOrgIds.length === 0) return [];
    const rows = await prisma.requisition.findMany({
      where: { organizationId: { in: branchOrgIds }, status: 'APPROVED' },
      include: {
        organization: { select: { id: true, name: true } },
        sections: {
          select: {
            departmentTag: true,
            lines: { where: { deletedAt: null }, select: { requestedQty: true, approvedQty: true } },
          },
        },
        dispatches: { select: { departmentTag: true, status: true } },
      },
      orderBy: { approvedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      type: r.type,
      openedAt: r.openedAt,
      toOrganization: r.organization,
      sections: r.sections,
      dispatches: r.dispatches,
    }));
  },

  /**
   * One requisition's fulfil detail, scoped by explicit branchOrgIds
   * (same cross-org exception as the queue read above) — never an unscoped
   * `findFirst({ where: { id } })`.
   */
  findRequisitionForFulfil: async (
    requisitionId: string,
    branchOrgIds: string[],
  ): Promise<{
    id: string;
    organizationId: string;
    status: string;
    type: string;
    openedAt: Date;
    toOrganizationName: string;
    sections: RequisitionSectionForFulfil[];
  } | null> => {
    if (branchOrgIds.length === 0) return null;
    const requisition = await prisma.requisition.findFirst({
      where: { id: requisitionId, organizationId: { in: branchOrgIds } },
      include: {
        organization: { select: { id: true, name: true } },
        sections: {
          include: {
            lines: {
              where: { deletedAt: null },
              include: { item: { select: { id: true, name: true, usageUnit: true, currentCost: true } } },
              orderBy: { id: 'asc' },
            },
          },
          orderBy: { departmentTag: 'asc' },
        },
      },
    });
    if (!requisition) return null;
    return {
      id: requisition.id,
      organizationId: requisition.organizationId,
      status: requisition.status,
      type: requisition.type,
      openedAt: requisition.openedAt,
      toOrganizationName: requisition.organization.name,
      sections: requisition.sections.map((s) => ({
        id: s.id,
        departmentTag: s.departmentTag,
        status: s.status,
        requisition: { id: requisition.id, organizationId: requisition.organizationId, toOrganizationName: requisition.organization.name },
        lines: s.lines,
      })),
    };
  },

  /** Count of dispatches already created today for a branch org — feeds the daily sequenceLabel (not a persistent counter). */
  countDispatchesTodayForBranch: async (toOrganizationId: string, tx: TxClient): Promise<number> => {
    const { start, end } = getTodayNairobiRangeUtc();
    return tx.dispatch.count({
      where: { toOrganizationId, dispatchedAt: { gte: start, lt: end } },
    });
  },

  /** Existing Dispatch row for (requisition, department) if the store already dispatched it — guards against double-dispatch. */
  findByRequisitionAndDepartment: async (
    requisitionId: string,
    departmentTag: DepartmentTag,
    hubOrgId: string,
    client: Client = prisma,
  ): Promise<Dispatch | null> => {
    return client.dispatch.findFirst({ where: { requisitionId, departmentTag, organizationId: hubOrgId } });
  },

  create: async (
    input: {
      organizationId: string;
      toOrganizationId: string;
      requisitionId: string;
      departmentTag: DepartmentTag;
      sequenceLabel: string;
      dispatchedById: string;
      dispatchedAt: Date;
      lines: {
        requisitionLineId: string | null;
        inventoryItemId: string;
        requestedQty: Prisma.Decimal.Value | null;
        dispatchedQty: Prisma.Decimal.Value;
        costAtDispatch: Prisma.Decimal.Value;
        isSubstitute: boolean;
        substituteNote: string | null;
      }[];
    },
    tx: TxClient,
  ): Promise<Dispatch> => {
    return tx.dispatch.create({
      data: {
        organizationId: input.organizationId,
        toOrganizationId: input.toOrganizationId,
        requisitionId: input.requisitionId,
        departmentTag: input.departmentTag,
        sequenceLabel: input.sequenceLabel,
        status: 'IN_TRANSIT',
        dispatchedById: input.dispatchedById,
        dispatchedAt: input.dispatchedAt,
        lines: { createMany: { data: input.lines } },
      },
    });
  },

  /** Delivery-note read: one Dispatch + lines, shared by the print and on-screen renderers (one record, two views). */
  findByIdWithLines: async (id: string, client: Client = prisma): Promise<DispatchWithLines | null> => {
    return client.dispatch.findFirst({
      where: { id },
      include: {
        toOrganization: { select: { id: true, name: true } },
        dispatchedBy: { select: { id: true, name: true } },
        confirmedBy: { select: { id: true, name: true } },
        lines: { include: { item: { select: { id: true, name: true, usageUnit: true } } }, orderBy: { id: 'asc' } },
      },
    });
  },

  /** Same shape, but org-scoped to the hub — used by the store-side detail read (not the branch-side, which Session B scopes by toOrganizationId). */
  findByIdWithLinesForHub: async (id: string, hubOrgId: string): Promise<DispatchWithLines | null> => {
    return prisma.dispatch.findFirst({
      where: { id, organizationId: hubOrgId },
      include: {
        toOrganization: { select: { id: true, name: true } },
        dispatchedBy: { select: { id: true, name: true } },
        confirmedBy: { select: { id: true, name: true } },
        lines: { include: { item: { select: { id: true, name: true, usageUnit: true } } }, orderBy: { id: 'asc' } },
      },
    });
  },

  /** Active department heads for the receiving branch's department — recipients of the in-transit push. */
  findDepartmentHeads: async (organizationId: string, departmentTag: DepartmentTag): Promise<{ id: string; name: string }[]> => {
    return prisma.user.findMany({
      where: { organizationId, departmentTag, isDepartmentHead: true, isActive: true },
      select: { id: true, name: true },
    });
  },

  // ── Milestone Five, Session B — branch-side receiving ─────────────────────

  /**
   * Branch's own dispatches — Branch Manager sees every department,
   * Department Head sees only `departmentTag` (role-gated by the caller,
   * mirrors `requisitions-service.ts`'s `assertOwnDepartment` pattern:
   * this repository method takes an already-resolved department filter,
   * the service decides whether to pass one).
   */
  findDispatchesForBranch: async (
    toOrganizationId: string,
    departmentTag: DepartmentTag | null,
    limit: number,
  ): Promise<DispatchWithLines[]> => {
    return prisma.dispatch.findMany({
      where: {
        toOrganizationId,
        ...(departmentTag ? { departmentTag } : {}),
        status: { in: ['IN_TRANSIT', 'CONFIRMED', 'DISCREPANCY_OPEN'] },
      },
      include: {
        toOrganization: { select: { id: true, name: true } },
        dispatchedBy: { select: { id: true, name: true } },
        confirmedBy: { select: { id: true, name: true } },
        lines: { include: { item: { select: { id: true, name: true, usageUnit: true } } }, orderBy: { id: 'asc' } },
      },
      orderBy: { dispatchedAt: 'desc' },
      take: limit,
    });
  },

  /** Same shape, but org-scoped to the receiving branch — used by the branch-side detail read (never hub-scoped). */
  findByIdWithLinesForBranch: async (id: string, toOrganizationId: string): Promise<DispatchWithLines | null> => {
    return prisma.dispatch.findFirst({
      where: { id, toOrganizationId },
      include: {
        toOrganization: { select: { id: true, name: true } },
        dispatchedBy: { select: { id: true, name: true } },
        confirmedBy: { select: { id: true, name: true } },
        lines: { include: { item: { select: { id: true, name: true, usageUnit: true } } }, orderBy: { id: 'asc' } },
      },
    });
  },

  /**
   * Guarded status transition, same "no partial-signed state" pattern as
   * `goodsReceiptRepository.markSigned` and Session A's own dispatch create:
   * `updateMany` with the current status (IN_TRANSIT) in the `where`, a
   * `count === 0` means someone else confirmed it first — the caller rolls
   * back, no partial ledger writes.
   */
  markConfirmed: async (
    id: string,
    toOrganizationId: string,
    tx: TxClient,
    data: { status: DispatchStatus; confirmedById: string; confirmedAt: Date; confirmedOnBehalf: boolean },
  ): Promise<number> => {
    const updated = await tx.dispatch.updateMany({
      where: { id, toOrganizationId, status: 'IN_TRANSIT' },
      data,
    });
    return updated.count;
  },

  /** Active Branch Managers for the branch org — recipients of variance/resolution pushes. */
  findBranchManagers: async (organizationId: string): Promise<{ id: string; name: string }[]> => {
    return prisma.user.findMany({
      where: { organizationId, role: 'MANAGER', isActive: true },
      select: { id: true, name: true },
    });
  },
};
