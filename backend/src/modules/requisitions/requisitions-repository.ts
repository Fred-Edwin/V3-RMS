import { Prisma, type DepartmentTag, type Requisition, type RequisitionSection, type RequisitionLine } from '@prisma/client';
import { prisma } from '../../config/database';
import { getTodayNairobiRangeUtc } from '../../utils/date-only';

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
};
