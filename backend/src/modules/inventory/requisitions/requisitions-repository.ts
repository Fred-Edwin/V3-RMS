import { Prisma, type DepartmentTag, type RequisitionAdditionStatus, type RequisitionSectionStatus, type RequisitionStatus, type RequisitionType, type UserRole } from '@prisma/client';
import { prisma } from '../../../config/database';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Requisitions: database access only, no rules. Every query names the branch (`siteId`; column `organization_id`). The one
 * deliberate exception is a hub reader (Director, Store Manager, Accountant, Attendant, System Admin), who reads any branch: the
 * service passes `{ anyBranch: true }` and the query still limits itself to branch sites, never the Central Store.
 */
export type Scope = { siteId: string } | { anyBranch: true };
export const scopeWhere = (scope: Scope): Prisma.RequisitionWhereInput => ('siteId' in scope ? { siteId: scope.siteId } : { site: { type: 'BRANCH' } });

const personSelect = { id: true, name: true, role: true } as const;
const departmentSelect = { id: true, name: true, status: true, key: true } as const;

const itemSelect = {
  id: true,
  name: true,
  usageUnit: true,
  currentCost: true,
  category: { select: { id: true, name: true, parentCategoryId: true } },
} as const;

const lineInclude = { item: { select: itemSelect } } as const;

export const fileInclude = {
  site: { select: { id: true, name: true, code: true } },
  openedBy: { select: personSelect },
  approvedBy: { select: personSelect },
  cancelledBy: { select: personSelect },
  sections: {
    include: {
      department: { select: departmentSelect },
      submittedBy: { select: personSelect },
      skippedBy: { select: personSelect },
      lines: { where: { deletedAt: null }, include: lineInclude, orderBy: [{ item: { name: 'asc' } }, { id: 'asc' }] },
    },
    orderBy: [{ department: { position: 'asc' } }, { id: 'asc' }],
  },
  additions: {
    include: { department: { select: departmentSelect }, addedBy: { select: personSelect }, approvedBy: { select: personSelect } },
    orderBy: { addedAt: 'asc' },
  },
} satisfies Prisma.RequisitionInclude;

export type RequisitionRecord = Prisma.RequisitionGetPayload<{ include: typeof fileInclude }>;
export type SectionRecord = RequisitionRecord['sections'][number];
export type LineRecord = SectionRecord['lines'][number];
export type AdditionRecord = RequisitionRecord['additions'][number];

export interface StaffRecord {
  id: string;
  name: string;
  role: UserRole;
  siteId: string | null;
  isDepartmentHead: boolean;
  departmentId: string | null;
}

export interface DepartmentWithItems {
  id: string;
  name: string;
  key: DepartmentTag | null;
  itemCount: number;
}

export interface TaggedItem {
  id: string;
  name: string;
  usageUnit: string;
  currentCost: Prisma.Decimal;
  category: { id: string; name: string; parentCategoryId: string | null } | null;
}

export interface EventInsert {
  requisitionId: string;
  sectionId?: string | null;
  type: string;
  actorId: string;
  actorRoleLabel: string;
  fromValue?: string | null;
  toValue?: string | null;
  reason?: string | null;
  lineId?: string | null;
  idempotencyKey?: string | null;
}

export const requisitionsRepository = {
  // --- Who ------------------------------------------------------------------------------------------------------------

  findStaff: (userId: string): Promise<StaffRecord | null> =>
    prisma.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      select: { id: true, name: true, role: true, siteId: true, isDepartmentHead: true, departmentId: true },
    }),

  /** The heads of departments at one branch (the user with isDepartmentHead whose departmentId matches). */
  listHeads: (siteId: string, departmentIds: string[]): Promise<Array<{ id: string; name: string; role: UserRole; departmentId: string }>> =>
    departmentIds.length === 0
      ? Promise.resolve([])
      : prisma.user
          .findMany({
            where: { siteId, isDepartmentHead: true, isActive: true, deletedAt: null, departmentId: { in: departmentIds } },
            select: { id: true, name: true, role: true, departmentId: true },
            orderBy: { name: 'asc' },
          })
          .then((rows) => rows.flatMap((r) => (r.departmentId ? [{ id: r.id, name: r.name, role: r.role, departmentId: r.departmentId }] : []))),

  // --- Reads ------------------------------------------------------------------------------------------------------------

  findFile: (id: string, scope: Scope, db: Db = prisma): Promise<RequisitionRecord | null> =>
    db.requisition.findFirst({ where: { id, ...scopeWhere(scope) }, include: fileInclude }),

  /** A start that carried this key (R11), for the replay. */
  findByStartKey: (siteId: string, openedById: string, idempotencyKey: string): Promise<{ id: string } | null> =>
    prisma.requisition.findFirst({ where: { siteId, openedById, idempotencyKey }, select: { id: true } }),

  /** A signing write that carried this key, for the replay. */
  findEventByKey: async (requisitionId: string, siteId: string, actorId: string, idempotencyKey: string): Promise<boolean> =>
    (await prisma.requisitionEvent.count({ where: { requisitionId, actorId, idempotencyKey, requisition: { siteId } } })) > 0,

  /** The open (Collecting or Ready to approve) requisition for a cycle at a branch. */
  findOpenForCycle: (siteId: string, cycle: RequisitionType, db: Db = prisma): Promise<{ id: string; reference: string } | null> =>
    db.requisition.findFirst({ where: { siteId, type: cycle, status: { in: ['OPEN', 'PENDING_APPROVAL'] } }, select: { id: true, reference: true } }),

  findSite: (siteId: string): Promise<{ id: string; name: string; code: string | null; type: 'BRANCH' | 'CENTRAL_STORE' } | null> =>
    prisma.site.findFirst({ where: { id: siteId }, select: { id: true, name: true, code: true, type: true } }),

  /** The branch (by id) that already holds a code, for the uniqueness check. */
  findSiteByCode: (code: string): Promise<{ id: string } | null> => prisma.site.findFirst({ where: { code }, select: { id: true } }),

  setSiteCode: (siteId: string, code: string): Promise<{ id: string; name: string; code: string | null }> =>
    prisma.site.update({ where: { id: siteId }, data: { code }, select: { id: true, name: true, code: true } }),

  findDepartment: (siteId: string, departmentId: string): Promise<{ id: string; name: string } | null> =>
    prisma.department.findFirst({ where: { id: departmentId, siteId }, select: { id: true, name: true } }),

  /** The branch's active departments with how many live items are tagged to each. */
  listActiveDepartments: async (siteId: string, db: Db = prisma): Promise<DepartmentWithItems[]> => {
    const rows = await db.department.findMany({
      where: { siteId, status: 'ACTIVE' },
      select: { id: true, name: true, key: true, _count: { select: { items: { where: { item: { deletedAt: null } } } } } },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, name: r.name, key: r.key, itemCount: r._count.items }));
  },

  /** Live items tagged to a department of this branch, with category and cost. The department must belong to the branch. */
  listTaggedItems: async (siteId: string, departmentId: string, db: Db = prisma): Promise<TaggedItem[]> => {
    const rows = await db.itemDepartment.findMany({
      where: { departmentId, department: { siteId }, item: { deletedAt: null } },
      select: { item: { select: itemSelect } },
      orderBy: { item: { name: 'asc' } },
    });
    return rows.map((r) => r.item);
  },

  /** Of these item ids, the ones that are live and tagged to the department. */
  findTaggedItemIds: async (siteId: string, departmentId: string, itemIds: string[], db: Db = prisma): Promise<Set<string>> => {
    if (itemIds.length === 0) return new Set();
    const rows = await db.itemDepartment.findMany({
      where: { departmentId, department: { siteId }, itemId: { in: itemIds }, item: { deletedAt: null } },
      select: { itemId: true },
    });
    return new Set(rows.map((r) => r.itemId));
  },

  /** The branch-department stock location of a department (none for a department added after the five were provisioned). */
  findDepartmentLocation: (siteId: string, departmentId: string, db: Db = prisma): Promise<{ id: string } | null> =>
    db.location.findFirst({ where: { siteId, type: 'BRANCH_DEPARTMENT', departmentId, isActive: true }, select: { id: true } }),

  /** Restock level and on hand per item at one branch-department location. On hand is the sum of the ledger. */
  readStock: async (
    siteId: string,
    locationId: string,
    itemIds: string[],
    db: Db = prisma,
  ): Promise<{ level: Map<string, Prisma.Decimal>; onHand: Map<string, Prisma.Decimal> }> => {
    if (itemIds.length === 0) return { level: new Map(), onHand: new Map() };
    const [levels, sums] = await Promise.all([
      db.restockLevel.findMany({ where: { siteId, locationId, inventoryItemId: { in: itemIds } }, select: { inventoryItemId: true, level: true } }),
      db.inventoryTransaction.groupBy({ by: ['inventoryItemId'], where: { siteId, locationId, inventoryItemId: { in: itemIds } }, _sum: { quantity: true } }),
    ]);
    return {
      level: new Map(levels.map((l) => [l.inventoryItemId, l.level])),
      onHand: new Map(sums.map((s) => [s.inventoryItemId, s._sum.quantity ?? new Prisma.Decimal(0)])),
    };
  },

  findCategoryNames: async (ids: string[]): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  /** Has the store signed this department's dispatch (Block 2: a live dispatch with a final-sign time)? A cancelled one does not count: the department is back in the queue. */
  hasDispatch: async (requisitionId: string, siteId: string, departmentId: string | null, db: Db = prisma): Promise<boolean> => {
    if (!departmentId) return false;
    return (await db.dispatch.count({ where: { requisitionId, toSiteId: siteId, departmentId, signedAt: { not: null }, status: { not: 'CANCELLED' } } })) > 0;
  },

  // --- Numbering and locking ---------------------------------------------------------------------------------------------

  /** Serialises the starts for one branch and cycle, so two parallel starts cannot both find "none open". Released at commit. */
  lockCycle: async (tx: Prisma.TransactionClient, siteId: string, cycle: RequisitionType): Promise<void> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`requisition:${siteId}:${cycle}`}))`;
  },

  // --- Writes (callers run them inside one `$transaction`) -----------------------------------------------------------------

  createRequisition: (
    tx: Prisma.TransactionClient,
    data: { siteId: string; type: RequisitionType; reference: string; openedById: string; urgent: boolean; urgentNote: string | null; idempotencyKey: string },
  ): Promise<{ id: string }> =>
    tx.requisition.create({
      data: {
        siteId: data.siteId,
        type: data.type,
        reference: data.reference,
        openedById: data.openedById,
        urgent: data.urgent,
        urgentAt: data.urgent ? new Date() : null,
        urgentNote: data.urgentNote,
        idempotencyKey: data.idempotencyKey,
      },
      select: { id: true },
    }),

  createSection: (
    tx: Prisma.TransactionClient,
    data: { requisitionId: string; departmentId: string; departmentTag: DepartmentTag | null; status: RequisitionSectionStatus; skippedAt?: Date },
  ): Promise<{ id: string }> =>
    tx.requisitionSection.create({
      data: {
        requisitionId: data.requisitionId,
        departmentId: data.departmentId,
        departmentTag: data.departmentTag,
        status: data.status,
        ...(data.skippedAt ? { skippedAt: data.skippedAt } : {}),
      },
      select: { id: true },
    }),

  createLines: async (
    tx: Prisma.TransactionClient,
    sectionId: string,
    lines: Array<{
      inventoryItemId: string;
      requestedQty: Prisma.Decimal;
      suggestedQty: Prisma.Decimal | null;
      parAtRequest: Prisma.Decimal | null;
      onHandAtRequest: Prisma.Decimal | null;
      additionId?: string;
    }>,
  ): Promise<void> => {
    if (lines.length === 0) return;
    await tx.requisitionLine.createMany({ data: lines.map((l) => ({ requisitionSectionId: sectionId, ...l })) });
  },

  /** Section update scoped through its requisition's branch. Returns false when the section is not at this branch. */
  updateSection: async (
    tx: Prisma.TransactionClient,
    siteId: string,
    sectionId: string,
    data: Prisma.RequisitionSectionUncheckedUpdateManyInput,
  ): Promise<boolean> => (await tx.requisitionSection.updateMany({ where: { id: sectionId, requisition: { siteId } }, data })).count > 0,

  updateLine: async (tx: Prisma.TransactionClient, siteId: string, lineId: string, data: Prisma.RequisitionLineUncheckedUpdateManyInput): Promise<boolean> =>
    (await tx.requisitionLine.updateMany({ where: { id: lineId, section: { requisition: { siteId } } }, data })).count > 0,

  /** Soft-removes lines (the file keeps them out of every read and out of the old dispatch). */
  removeLines: async (tx: Prisma.TransactionClient, siteId: string, lineIds: string[]): Promise<void> => {
    if (lineIds.length === 0) return;
    await tx.requisitionLine.updateMany({ where: { id: { in: lineIds }, deletedAt: null, section: { requisition: { siteId } } }, data: { deletedAt: new Date() } });
  },

  /** Soft-removes every live line of a section (Send without this section). */
  removeSectionLines: async (tx: Prisma.TransactionClient, siteId: string, sectionId: string): Promise<void> => {
    await tx.requisitionLine.updateMany({ where: { requisitionSectionId: sectionId, deletedAt: null, section: { requisition: { siteId } } }, data: { deletedAt: new Date() } });
  },

  setStatus: async (tx: Prisma.TransactionClient, siteId: string, id: string, status: RequisitionStatus, data: Prisma.RequisitionUncheckedUpdateManyInput = {}): Promise<boolean> =>
    (await tx.requisition.updateMany({ where: { id, siteId }, data: { status, ...data } })).count > 0,

  /** Setting Urgent starts the hour afresh (`urgentEscalatedAt` is cleared); clearing it drops the note. */
  setUrgent: async (tx: Prisma.TransactionClient, siteId: string, id: string, data: { urgent: boolean; urgentAt: Date | null; urgentNote: string | null }): Promise<void> => {
    await tx.requisition.updateMany({ where: { id, siteId }, data: { ...data, urgentEscalatedAt: null } });
  },

  setUrgentNote: async (tx: Prisma.TransactionClient, siteId: string, id: string, urgentNote: string | null): Promise<void> => {
    await tx.requisition.updateMany({ where: { id, siteId }, data: { urgentNote } });
  },

  /**
   * Approval: the unit cost is frozen on every live line of a Sent section, an unset Approved quantity takes the requested one (the old
   * dispatch reads `approvedQty`), and any section that never went is marked Skipped so it carries no lines.
   */
  freezeForApproval: async (tx: Prisma.TransactionClient, siteId: string, requisitionId: string): Promise<void> => {
    const sections = await tx.requisitionSection.findMany({
      where: { requisitionId, requisition: { siteId } },
      select: { id: true, status: true, lines: { where: { deletedAt: null }, select: { id: true, requestedQty: true, approvedQty: true, item: { select: { currentCost: true } } } } },
    });
    for (const section of sections) {
      if (section.status === 'SUBMITTED') {
        for (const line of section.lines) {
          await tx.requisitionLine.updateMany({
            where: { id: line.id, section: { requisition: { siteId } } },
            data: { unitCostAtApproval: line.item.currentCost, approvedQty: line.approvedQty ?? line.requestedQty },
          });
        }
      } else if (section.status !== 'SKIPPED') {
        await tx.requisitionLine.updateMany({ where: { requisitionSectionId: section.id, deletedAt: null, section: { requisition: { siteId } } }, data: { deletedAt: new Date() } });
        await tx.requisitionSection.updateMany({ where: { id: section.id, requisition: { siteId } }, data: { status: 'SKIPPED', skippedAt: new Date() } });
      }
    }
  },

  createAddition: (
    tx: Prisma.TransactionClient,
    data: { requisitionId: string; departmentId: string; addedById: string; sentPinSignedAt: Date },
  ): Promise<{ id: string }> => tx.requisitionAddition.create({ data, select: { id: true } }),

  setAdditionStatus: async (
    tx: Prisma.TransactionClient,
    siteId: string,
    additionId: string,
    data: { status: RequisitionAdditionStatus; approvedById: string; approvedAt: Date },
  ): Promise<boolean> => (await tx.requisitionAddition.updateMany({ where: { id: additionId, requisition: { siteId } }, data })).count > 0,

  /** An addition's requisition and department (the Block 2 hand-off that joins its lines to the unsigned dispatch). */
  findAdditionRef: (additionId: string, db: Db = prisma) =>
    db.requisitionAddition.findFirst({ where: { id: additionId }, select: { id: true, requisitionId: true, departmentId: true, requisition: { select: { siteId: true } } } }),

  /** Sets an APPROVED requisition to CLOSED (the Block 2 hand-off `closeIfComplete`); the row count says whether it closed now. */
  closeRequisition: async (requisitionId: string, closedAt: Date, db: Db = prisma): Promise<boolean> =>
    (await db.requisition.updateMany({ where: { id: requisitionId, status: 'APPROVED' }, data: { status: 'CLOSED', closedAt } })).count > 0,

  /** A reversed finding holds a gap again: a requisition that had closed on it goes back to APPROVED (Block 2, back end D). */
  reopenRequisition: async (requisitionId: string, db: Db = prisma): Promise<boolean> =>
    (await db.requisition.updateMany({ where: { id: requisitionId, status: 'CLOSED' }, data: { status: 'APPROVED', closedAt: null } })).count > 0,

  /** Approval of an addition freezes the cost and sets the Approved quantity on its lines. */
  freezeAdditionLines: async (tx: Prisma.TransactionClient, siteId: string, additionId: string): Promise<void> => {
    const lines = await tx.requisitionLine.findMany({
      where: { additionId, deletedAt: null, section: { requisition: { siteId } } },
      select: { id: true, requestedQty: true, approvedQty: true, item: { select: { currentCost: true } } },
    });
    for (const line of lines) {
      await tx.requisitionLine.updateMany({
        where: { id: line.id, section: { requisition: { siteId } } },
        data: { unitCostAtApproval: line.item.currentCost, approvedQty: line.approvedQty ?? line.requestedQty },
      });
    }
  },

  appendEvent: async (tx: Prisma.TransactionClient, data: EventInsert): Promise<void> => {
    await tx.requisitionEvent.create({
      data: {
        requisitionId: data.requisitionId,
        sectionId: data.sectionId ?? null,
        type: data.type,
        actorId: data.actorId,
        actorRoleLabel: data.actorRoleLabel,
        fromValue: data.fromValue ?? null,
        toValue: data.toValue ?? null,
        reason: data.reason ?? null,
        lineId: data.lineId ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
      },
    });
  },

  /**
   * THE ESCALATION JOB's reads and claim (contract §7). The one place that looks at every branch at once: a system job with no
   * caller. Urgent, still unsigned (Collecting or Ready to approve), urgent since `cutoff` or earlier, not yet escalated.
   */
  findDueForEscalation: (cutoff: Date): Promise<Array<{ id: string; siteId: string; reference: string; urgentNote: string | null; siteName: string }>> =>
    prisma.requisition
      .findMany({
        where: { urgent: true, urgentAt: { lte: cutoff }, urgentEscalatedAt: null, status: { in: ['OPEN', 'PENDING_APPROVAL'] }, site: { type: 'BRANCH' } },
        select: { id: true, siteId: true, reference: true, urgentNote: true, site: { select: { name: true } } },
        orderBy: { urgentAt: 'asc' },
      })
      .then((rows) => rows.map((r) => ({ id: r.id, siteId: r.siteId, reference: r.reference, urgentNote: r.urgentNote, siteName: r.site.name }))),

  /** Stamps `urgentEscalatedAt` only if it is still unset and the requisition is still urgent and unsigned. True for exactly one caller. */
  claimEscalation: async (siteId: string, id: string, cutoff: Date, at: Date): Promise<boolean> =>
    (
      await prisma.requisition.updateMany({
        where: { id, siteId, urgent: true, urgentAt: { lte: cutoff }, urgentEscalatedAt: null, status: { in: ['OPEN', 'PENDING_APPROVAL'] } },
        data: { urgentEscalatedAt: at },
      })
    ).count > 0,

  /** When did the requisition become "all in"? The latest Sent or Skipped moment of its sections. */
  findAllInAt: async (requisitionId: string, siteId: string): Promise<Date | null> => {
    const rows = await prisma.requisitionSection.findMany({ where: { requisitionId, requisition: { siteId } }, select: { submittedAt: true, skippedAt: true } });
    const times = rows.flatMap((r) => [r.submittedAt, r.skippedAt]).filter((t): t is Date => t !== null);
    return times.length === 0 ? null : new Date(Math.max(...times.map((t) => t.getTime())));
  },

  /** The facts the state rules need, read inside the transaction that just changed a section. */
  readSectionFacts: async (
    tx: Prisma.TransactionClient,
    siteId: string,
    requisitionId: string,
  ): Promise<{ status: RequisitionStatus; sections: Array<{ status: RequisitionSectionStatus; departmentActive: boolean }> } | null> => {
    const row = await tx.requisition.findFirst({
      where: { id: requisitionId, siteId },
      select: { status: true, sections: { select: { status: true, department: { select: { status: true } } } } },
    });
    if (!row) return null;
    return { status: row.status, sections: row.sections.map((s) => ({ status: s.status, departmentActive: s.department?.status === 'ACTIVE' })) };
  },
};
