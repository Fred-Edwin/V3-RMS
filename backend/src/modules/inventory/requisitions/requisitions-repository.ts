import { Prisma, type DepartmentTag, type Requisition, type RequisitionSection, type RequisitionLine } from '@prisma/client';
import { prisma } from '../../../config/database';
import { getTodayNairobiRangeUtc } from '../../../utils/date-only';
import type { RequisitionDisplayStatus } from './requisitions.types';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Requisitions (Session A — Department Head side only). No ledger write ever
// happens from this repository — Milestone Four does not touch
// InventoryTransaction (see session-a-plan.md §2).
// ---------------------------------------------------------------------------

const ALL_DEPARTMENT_TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

export type RequisitionWithMySection = Requisition & {
  sections: { departmentTag: DepartmentTag; status: RequisitionSection['status'] }[];
};

export type RequisitionSectionWithLines = RequisitionSection & {
  requisition: Pick<Requisition, 'id' | 'status'>;
  lines: (RequisitionLine & {
    item: { id: string; name: string; usageUnit: string; category: { id: string; name: string; parentCategoryId: string | null } | null };
  })[];
};

const approvalLineInclude = {
  item: {
    select: {
      id: true,
      name: true,
      usageUnit: true,
      category: { select: { id: true, name: true, parentCategoryId: true } },
    },
  },
} as const;

const approvalSectionInclude = {
  submittedBy: { select: { id: true, name: true } },
  lines: { where: { deletedAt: null }, include: approvalLineInclude, orderBy: { id: 'asc' } as const },
} as const;

export type RequisitionSectionForApproval = RequisitionSection & {
  submittedBy: { id: string; name: string } | null;
  lines: (RequisitionLine & {
    item: { id: string; name: string; usageUnit: string; category: { id: string; name: string; parentCategoryId: string | null } | null };
  })[];
};

export type RequisitionWithAllSections = Requisition & {
  approvedBy: { id: string; name: string } | null;
  sections: RequisitionSectionForApproval[];
};

export type RequisitionForManagerList = Requisition & {
  sections: { status: RequisitionSection['status']; lines: { requestedQty: Prisma.Decimal | null; approvedQty: Prisma.Decimal | null }[] }[];
};

export type RequisitionHistoryRowData = Requisition & {
  approvedBy: { id: string; name: string } | null;
  sections: { status: RequisitionSection['status']; returnedNote: string | null; lines: { requestedQty: Prisma.Decimal | null; approvedQty: Prisma.Decimal | null }[] }[];
  dispatches: { id: string; departmentTag: DepartmentTag; status: string; sequenceLabel: string }[];
};

export type CreateRequisitionInput = {
  organizationId: string;
  type: string;
  note?: string;
  openedById: string;
};

export const requisitionRepository = {
  /**
   * Opens a requisition and creates all 5 RequisitionSection rows (one per
   * DepartmentTag, NOT_STARTED) in one transaction.
   */
  create: async (input: CreateRequisitionInput): Promise<Requisition> => {
    return prisma.$transaction(async (tx) => {
      return tx.requisition.create({
        data: {
          organizationId: input.organizationId,
          type: input.type as never,
          note: input.note ?? null,
          openedById: input.openedById,
          sections: {
            createMany: {
              data: ALL_DEPARTMENT_TAGS.map((departmentTag) => ({ departmentTag, status: 'NOT_STARTED' as const })),
            },
          },
        },
      });
    });
  },

  /**
   * Role-scoped list for a Department Head: today's requisitions (Nairobi
   * calendar day — a department files 2-3 a day, e.g. Morning/Afternoon/
   * Evening/Ad-hoc, so "today" is the natural scope; older ones belong to a
   * future history screen, not this list) for their branch org, with just
   * enough section data for the service to derive `mySectionStatus` — never
   * other departments' full section detail.
   */
  findAllByOrganization: async (organizationId: string, limit: number): Promise<RequisitionWithMySection[]> => {
    const { start, end } = getTodayNairobiRangeUtc();
    return prisma.requisition.findMany({
      where: { organizationId, openedAt: { gte: start, lt: end } },
      include: { sections: { select: { departmentTag: true, status: true } } },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
  },

  findById: async (id: string, organizationId: string, client: Client = prisma): Promise<Requisition | null> => {
    return client.requisition.findFirst({ where: { id, organizationId } });
  },

  /**
   * Hard delete — the one exception to this module's soft-delete convention
   * (see `deleteLine` below). Only reachable when the caller has already
   * confirmed zero sections were ever SUBMITTED (session-1-quick-wins-prompt
   * #17): nothing of record exists yet on a requisition in that state, so
   * there is no audit trail to lose. All 5 sections start `NOT_STARTED` on
   * `create`, so a fresh requisition always has exactly 5 to delete.
   * FKs are `ON DELETE RESTRICT` throughout (lines -> sections ->
   * requisition), so deletion order matters here.
   */
  cancel: async (id: string, organizationId: string): Promise<boolean> => {
    return prisma.$transaction(async (tx) => {
      const requisition = await tx.requisition.findFirst({
        where: { id, organizationId },
        include: { sections: { select: { id: true, status: true } } },
      });
      if (!requisition) return false;
      if (requisition.sections.some((s) => s.status === 'SUBMITTED')) return false;

      const sectionIds = requisition.sections.map((s) => s.id);
      await tx.requisitionLine.deleteMany({ where: { requisitionSectionId: { in: sectionIds } } });
      await tx.requisitionSection.deleteMany({ where: { requisitionId: id } });
      await tx.requisition.delete({ where: { id } });
      return true;
    });
  },

  /**
   * Flips OPEN -> PENDING_APPROVAL. Guarded with a where-status check so it
   * only fires (and only counts) on the actual first transition — safe to
   * call unconditionally after a successful submit.
   */
  markPendingApprovalIfOpen: async (id: string, tx: TxClient): Promise<number> => {
    const updated = await tx.requisition.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: 'PENDING_APPROVAL' },
    });
    return updated.count;
  },

  findSectionWithLines: async (
    requisitionId: string,
    departmentTag: DepartmentTag,
    organizationId: string,
    client: Client = prisma,
  ): Promise<RequisitionSectionWithLines | null> => {
    return client.requisitionSection.findFirst({
      where: { requisitionId, departmentTag, requisition: { organizationId } },
      include: {
        requisition: { select: { id: true, status: true } },
        lines: {
          where: { deletedAt: null },
          include: {
            item: {
              select: {
                id: true,
                name: true,
                usageUnit: true,
                category: { select: { id: true, name: true, parentCategoryId: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
  },

  findSectionById: async (
    requisitionId: string,
    departmentTag: DepartmentTag,
    organizationId: string,
    client: Client = prisma,
  ): Promise<RequisitionSection | null> => {
    return client.requisitionSection.findFirst({
      where: { requisitionId, departmentTag, requisition: { organizationId } },
    });
  },

  /** Existing-line quantity edit (incl. "0" — zero-not-delete, row stays). */
  updateLineQty: async (lineId: string, requestedQty: Prisma.Decimal.Value | null, tx: TxClient): Promise<void> => {
    await tx.requisitionLine.update({ where: { id: lineId }, data: { requestedQty } });
  },

  /** New line via add-item; parAtRequest is snapshotted by the service before calling this. */
  createLine: async (
    sectionId: string,
    input: { inventoryItemId: string; requestedQty: Prisma.Decimal.Value | null; parAtRequest: Prisma.Decimal.Value | null },
    tx: TxClient,
  ): Promise<void> => {
    await tx.requisitionLine.create({
      data: {
        requisitionSectionId: sectionId,
        inventoryItemId: input.inventoryItemId,
        requestedQty: input.requestedQty,
        parAtRequest: input.parAtRequest,
      },
    });
  },

  updateManagerNote: async (sectionId: string, managerNote: string | null, tx: TxClient): Promise<void> => {
    await tx.requisitionSection.update({ where: { id: sectionId }, data: { managerNote } });
  },

  /**
   * State-transition method (submit/recall). `where` includes the expected
   * current status; zero rows affected -> service throws ConflictError. No
   * silent partial-state (receiving-repository.ts's markSigned precedent).
   */
  setSectionStatus: async (
    sectionId: string,
    fromStatuses: RequisitionSection['status'][],
    data: Partial<Pick<RequisitionSection, 'status' | 'submittedById' | 'submittedAt' | 'returnedNote'>>,
    tx: TxClient,
  ): Promise<number> => {
    const updated = await tx.requisitionSection.updateMany({
      where: { id: sectionId, status: { in: fromStatuses } },
      data,
    });
    return updated.count;
  },

  // -------------------------------------------------------------------------
  // Session B — Branch Manager approval.
  // -------------------------------------------------------------------------

  /**
   * All 5 sections + lines (excluding soft-deleted) + item + submitter +
   * approver, org-scoped through the relation (D-15 convention). The single
   * read the whole approval detail screen is built from.
   */
  findByIdWithAllSections: async (
    id: string,
    organizationId: string,
    client: Client = prisma,
  ): Promise<RequisitionWithAllSections | null> => {
    return client.requisition.findFirst({
      where: { id, organizationId },
      include: {
        approvedBy: { select: { id: true, name: true } },
        sections: { include: approvalSectionInclude, orderBy: { departmentTag: 'asc' } },
      },
    });
  },

  /** Manager's needs-approval list: today's requisitions, section+line shape only (totals/counts derived by the service). */
  findAllByOrganizationForManager: async (organizationId: string, limit: number): Promise<RequisitionForManagerList[]> => {
    const { start, end } = getTodayNairobiRangeUtc();
    return prisma.requisition.findMany({
      where: { organizationId, openedAt: { gte: start, lt: end } },
      include: {
        sections: {
          select: { status: true, lines: { where: { deletedAt: null }, select: { requestedQty: true, approvedQty: true } } },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });
  },

  updateLineApproval: async (
    lineId: string,
    data: { approvedQty: Prisma.Decimal.Value | null; editReason: string | null; editedById: string },
    tx: TxClient,
  ): Promise<void> => {
    await tx.requisitionLine.update({
      where: { id: lineId },
      data: { approvedQty: data.approvedQty, editReason: data.editReason, editedById: data.editedById },
    });
  },

  /** Manager delete — soft, keeps the audit trail. Never a hard delete. */
  softDeleteLine: async (lineId: string, tx: TxClient): Promise<void> => {
    await tx.requisitionLine.update({ where: { id: lineId }, data: { deletedAt: new Date() } });
  },

  /** Manager-added line: `requestedQty` stays null (decision #5 — "manager-added, head never asked"). */
  createManagerLine: async (
    sectionId: string,
    input: { inventoryItemId: string; approvedQty: Prisma.Decimal.Value; editedById: string; editReason: string | null },
    tx: TxClient,
  ): Promise<void> => {
    await tx.requisitionLine.create({
      data: {
        requisitionSectionId: sectionId,
        inventoryItemId: input.inventoryItemId,
        requestedQty: null,
        approvedQty: input.approvedQty,
        editedById: input.editedById,
        editReason: input.editReason,
        addedFromNote: true,
      },
    });
  },

  /**
   * Guarded updateMany — a `count()` under READ COMMITTED does not take row
   * locks, so it cannot detect a concurrent recall between the pre-load and
   * the write. `updateMany` does. Returns 0 when another manager already
   * signed (see `13F1-0` — the already-approved read-only state).
   */
  markApprovedIfPendingApproval: async (id: string, actorId: string, tx: TxClient): Promise<number> => {
    const updated = await tx.requisition.updateMany({
      where: { id, status: 'PENDING_APPROVAL' },
      data: { status: 'APPROVED', approvedById: actorId, approvedAt: new Date() },
    });
    return updated.count;
  },

  /**
   * Filters on `openedAt`, not `approvedAt` — a still-open or returned
   * requisition has no `approvedAt` yet but is still a real row a manager
   * searching history by date range should find. Mirrors
   * `receiving-repository.ts` `findHistoryRows`.
   */
  findHistoryRows: async (
    organizationId: string,
    filters: { from?: Date; to?: Date; status?: RequisitionDisplayStatus; limit: number; cursor?: string },
  ): Promise<RequisitionHistoryRowData[]> => {
    const where: Prisma.RequisitionWhereInput = {
      organizationId,
      ...(filters.from || filters.to
        ? { openedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    };

    return prisma.requisition.findMany({
      where,
      include: {
        approvedBy: { select: { id: true, name: true } },
        sections: {
          select: {
            status: true,
            returnedNote: true,
            lines: { where: { deletedAt: null }, select: { requestedQty: true, approvedQty: true } },
          },
        },
        // Milestone Five addition (session-a-plan.md §1.4) — cross-links
        // History to the Dispatch/Delivery screens. Additive only.
        dispatches: {
          select: { id: true, departmentTag: true, status: true, sequenceLabel: true },
          orderBy: { departmentTag: 'asc' },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: filters.limit,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
  },

  findBranchManagers: async (organizationId: string): Promise<{ id: string; name: string }[]> => {
    return prisma.user.findMany({
      where: { organizationId, role: 'MANAGER', isActive: true },
      select: { id: true, name: true },
    });
  },

  /**
   * Resolves via `submittedById` where present, falling back to the
   * department's head for the not-submitted "nudge" case (a NOT_STARTED/
   * DRAFT section has no submitter yet).
   */
  findSectionHeads: async (
    organizationId: string,
    departmentTag: DepartmentTag,
    submittedById: string | null,
  ): Promise<{ id: string; name: string }[]> => {
    if (submittedById) {
      const submitter = await prisma.user.findUnique({ where: { id: submittedById }, select: { id: true, name: true } });
      return submitter ? [submitter] : [];
    }
    return prisma.user.findMany({
      where: { organizationId, departmentTag, isDepartmentHead: true, isActive: true },
      select: { id: true, name: true },
    });
  },
};
