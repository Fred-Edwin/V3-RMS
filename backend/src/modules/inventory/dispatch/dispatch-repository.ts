import { Prisma, type DispatchStatus } from '@prisma/client';
import { prisma } from '../../../config/database';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Dispatch: database access only, no rules. A Dispatch is owned by the HUB (`siteId`, column `organization_id`) and addressed to a
 * branch (`toSiteId`); every query names the hub, and a Branch Manager's reads add their own `toSiteId`. The queue reads approved
 * requisitions of every branch (a hub reader), which is the one deliberate cross-site read (CENTRAL_STORE_SCOPING_DESIGN.md §4).
 */
export interface DispatchScope {
  hubId: string;
  /** Set for a Branch Manager: only dispatches to this branch. */
  toSiteId?: string;
  /** Set for the Attendant: only dispatches they packed or signed. */
  packedOrSignedBy?: string;
}

const scopeWhere = (s: DispatchScope): Prisma.DispatchWhereInput => ({
  siteId: s.hubId,
  ...(s.toSiteId ? { toSiteId: s.toSiteId } : {}),
  ...(s.packedOrSignedBy ? { OR: [{ packedById: s.packedOrSignedBy }, { signedById: s.packedOrSignedBy }] } : {}),
});

const personSelect = { id: true, name: true, role: true } as const;
const itemSelect = {
  id: true,
  name: true,
  usageUnit: true,
  currentCost: true,
  category: { select: { id: true, name: true, parentCategoryId: true } },
} as const;

/** Lines of a section that are packed: not deleted, and not an addition still waiting for approval. */
const packableLines = { deletedAt: null, OR: [{ additionId: null }, { addition: { status: 'APPROVED' as const } }] } satisfies Prisma.RequisitionLineWhereInput;

const queueInclude = {
  site: { select: { id: true, name: true, code: true } },
  sections: {
    where: { status: 'SUBMITTED' as const, departmentId: { not: null } },
    select: {
      departmentId: true,
      department: { select: { id: true, name: true, position: true } },
      lines: { where: packableLines, select: { id: true, requestedQty: true, approvedQty: true } },
    },
  },
  dispatches: {
    where: { status: { not: 'CANCELLED' as const } },
    select: { id: true, departmentId: true, status: true, signedAt: true, lines: { select: { packedTick: true } } },
  },
} satisfies Prisma.RequisitionInclude;

export type QueueRequisition = Prisma.RequisitionGetPayload<{ include: typeof queueInclude }>;

const packInclude = {
  site: { select: { id: true, name: true, code: true } },
  approvedBy: { select: personSelect },
  sections: {
    where: { status: 'SUBMITTED' as const, departmentId: { not: null } },
    select: {
      id: true,
      departmentId: true,
      department: { select: { id: true, name: true, position: true } },
      lines: { where: packableLines, include: { item: { select: itemSelect } }, orderBy: [{ item: { name: 'asc' as const } }, { id: 'asc' as const }] },
    },
    orderBy: [{ department: { position: 'asc' as const } }, { id: 'asc' as const }],
  },
} satisfies Prisma.RequisitionInclude;

export type PackRequisition = Prisma.RequisitionGetPayload<{ include: typeof packInclude }>;
export type PackSection = PackRequisition['sections'][number];

const packDispatchInclude = {
  lines: { include: { item: { select: itemSelect } }, orderBy: [{ item: { name: 'asc' as const } }, { id: 'asc' as const }] },
} satisfies Prisma.DispatchInclude;

export type PackDispatch = Prisma.DispatchGetPayload<{ include: typeof packDispatchInclude }>;
export type PackDispatchLine = PackDispatch['lines'][number];

export const fileInclude = {
  toSite: { select: { id: true, name: true, code: true } },
  requisition: { select: { id: true, reference: true, approvedAt: true, approvedBy: { select: personSelect } } },
  department: { select: { id: true, name: true } },
  packedBy: { select: personSelect },
  signedBy: { select: personSelect },
  countedBy: { select: personSelect },
  cancelledBy: { select: personSelect },
  carrier: { select: { id: true, name: true, kind: true } },
  lines: {
    include: {
      item: { select: itemSelect },
      photos: { select: { id: true }, orderBy: { createdAt: 'asc' as const } },
      discrepancy: { select: { id: true, reference: true, status: true } },
    },
    orderBy: [{ item: { name: 'asc' as const } }, { id: 'asc' as const }],
  },
  events: { include: { actor: { select: personSelect } }, orderBy: [{ at: 'asc' as const }, { id: 'asc' as const }] },
  discrepancies: { select: { id: true, reference: true, status: true, lossValue: true } },
} satisfies Prisma.DispatchInclude;

export type DispatchRecord = Prisma.DispatchGetPayload<{ include: typeof fileInclude }>;

const mineSelect = {
  id: true,
  reference: true,
  status: true,
  signedAt: true,
  toSite: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true } },
  lines: { select: { id: true } },
  discrepancies: { select: { status: true } },
} satisfies Prisma.DispatchSelect;

export type MineRecord = Prisma.DispatchGetPayload<{ select: typeof mineSelect }>;

export interface NewDispatchLine {
  requisitionLineId: string;
  inventoryItemId: string;
  requestedQty: Prisma.Decimal;
  sentQty: Prisma.Decimal;
}

export const dispatchRepository = {
  // --- Reads: the queue and the pack views -------------------------------------------------------------------------------

  /** Approved requisitions of every branch with what is packed so far, oldest approval first (P1). */
  findApprovedForQueue: (db: Db = prisma): Promise<QueueRequisition[]> =>
    db.requisition.findMany({ where: { status: 'APPROVED', site: { type: 'BRANCH' } }, include: queueInclude, orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }] }),

  /** One approved requisition with its Sent sections and their packable lines (P2 to P5). Null when it is not approved or not a branch's. */
  findRequisitionForPack: (requisitionId: string, db: Db = prisma): Promise<PackRequisition | null> =>
    db.requisition.findFirst({ where: { id: requisitionId, status: 'APPROVED', site: { type: 'BRANCH' } }, include: packInclude }),

  /** The requisition's status, so a pack call can say "not approved" or "cancelled" rather than "not found". */
  findRequisitionStatus: (requisitionId: string, db: Db = prisma): Promise<{ id: string; status: string } | null> =>
    db.requisition.findFirst({ where: { id: requisitionId, site: { type: 'BRANCH' } }, select: { id: true, status: true } }),

  /** The live (not cancelled) dispatch of a department of a requisition, with its lines. */
  findLiveDispatch: (hubId: string, requisitionId: string, departmentId: string, db: Db = prisma): Promise<PackDispatch | null> =>
    db.dispatch.findFirst({ where: { siteId: hubId, requisitionId, departmentId, status: { not: 'CANCELLED' } }, include: packDispatchInclude }),

  /** Live dispatches with their discrepancy statuses (the hand-off that closes settled dispatches). */
  listLiveDispatchesWithGaps: (hubId: string, requisitionId: string, db: Db = prisma) =>
    db.dispatch.findMany({
      where: { siteId: hubId, requisitionId, status: { not: 'CANCELLED' } },
      select: { id: true, departmentId: true, status: true, discrepancies: { select: { status: true } } },
    }),

  /** Every live dispatch of a requisition (the review, the sign and the roll-up). */
  listLiveDispatches: (hubId: string, requisitionId: string, db: Db = prisma): Promise<PackDispatch[]> =>
    db.dispatch.findMany({ where: { siteId: hubId, requisitionId, status: { not: 'CANCELLED' } }, include: packDispatchInclude }),

  // --- Reads: the file, the siblings, the Attendant's list ----------------------------------------------------------------

  findFile: (id: string, scope: DispatchScope, db: Db = prisma): Promise<DispatchRecord | null> =>
    db.dispatch.findFirst({ where: { id, ...scopeWhere(scope) }, include: fileInclude }),

  /** The other dispatches of the same requisition (the file's roll-up), cancelled ones left out. */
  listSiblings: (hubId: string, requisitionId: string, excludeId: string, db: Db = prisma) =>
    db.dispatch.findMany({
      where: { siteId: hubId, requisitionId, id: { not: excludeId }, status: { not: 'CANCELLED' }, signedAt: { not: null } },
      select: { id: true, reference: true, status: true, signedAt: true, department: { select: { name: true, position: true } }, lines: { select: { packedTick: true } }, discrepancies: { select: { status: true } } },
      orderBy: { department: { position: 'asc' } },
    }),

  /** The dispatches of one requisition as the requisition file's roll-up (R3) shows them. */
  listForRequisition: (requisitionId: string, db: Db = prisma) =>
    db.dispatch.findMany({
      where: { requisitionId, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        reference: true,
        status: true,
        signedAt: true,
        countedAt: true,
        departmentId: true,
        department: { select: { name: true, position: true } },
        carrier: { select: { name: true } },
        lines: { select: { packedTick: true } },
        discrepancies: { select: { status: true } },
      },
      orderBy: { department: { position: 'asc' } },
    }),

  listMine: async (
    scope: DispatchScope,
    f: { statuses: DispatchStatus[]; branchId?: string; from?: Date; to?: Date; skip: number; take: number },
    db: Db = prisma,
  ): Promise<{ rows: MineRecord[]; total: number }> => {
    const where: Prisma.DispatchWhereInput = {
      ...scopeWhere(scope),
      status: { in: f.statuses },
      ...(f.branchId ? { toSiteId: f.branchId } : {}),
      ...(f.from || f.to ? { signedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
    };
    const [rows, total] = await Promise.all([
      db.dispatch.findMany({ where, select: mineSelect, orderBy: [{ signedAt: 'desc' }, { id: 'desc' }], skip: f.skip, take: f.take }),
      db.dispatch.count({ where }),
    ]);
    return { rows, total };
  },

  countMine: (scope: DispatchScope, statuses: DispatchStatus[], db: Db = prisma): Promise<number> =>
    db.dispatch.count({ where: { ...scopeWhere(scope), status: { in: statuses } } }),

  // --- Writes: creating, syncing and saving the pack -----------------------------------------------------------------------

  createDispatch: (
    tx: Db,
    data: { hubId: string; toSiteId: string; requisitionId: string; departmentId: string; lines: NewDispatchLine[] },
  ): Promise<PackDispatch> =>
    tx.dispatch.create({
      data: {
        siteId: data.hubId,
        toSiteId: data.toSiteId,
        requisitionId: data.requisitionId,
        departmentId: data.departmentId,
        lines: { create: data.lines.map((l) => ({ requisitionLineId: l.requisitionLineId, inventoryItemId: l.inventoryItemId, requestedQty: l.requestedQty, sentQty: l.sentQty })) },
      },
      include: packDispatchInclude,
    }),

  addLines: async (tx: Db, dispatchId: string, lines: NewDispatchLine[]): Promise<void> => {
    if (lines.length === 0) return;
    await tx.dispatchLine.createMany({
      data: lines.map((l) => ({ dispatchId, requisitionLineId: l.requisitionLineId, inventoryItemId: l.inventoryItemId, requestedQty: l.requestedQty, sentQty: l.sentQty })),
    });
  },

  updateLineQuantities: (tx: Db, lineId: string, data: { requestedQty: Prisma.Decimal; sentQty: Prisma.Decimal }) =>
    tx.dispatchLine.update({ where: { id: lineId }, data }),

  deleteLines: async (tx: Db, ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    await tx.dispatchLine.deleteMany({ where: { id: { in: ids } } });
  },

  savePackLine: (tx: Db, lineId: string, data: { sentQty: Prisma.Decimal; packedTick: boolean }) => tx.dispatchLine.update({ where: { id: lineId }, data }),

  setStatus: (tx: Db, id: string, status: DispatchStatus) => tx.dispatch.update({ where: { id }, data: { status } }),

  /** CONFIRMED dispatches whose discrepancies are all settled (or that had none) become CLOSED. */
  markClosed: async (db: Db, ids: string[], closedAt: Date): Promise<void> => {
    if (ids.length === 0) return;
    await db.dispatch.updateMany({ where: { id: { in: ids }, status: 'CONFIRMED' }, data: { status: 'CLOSED', closedAt } });
  },

  // --- Writes: the final sign (P5) -----------------------------------------------------------------------------------------

  /** Serialises signs and cancels at one hub, so two Attendants cannot both send the last unit. Released at commit. */
  lockHub: async (tx: Db, hubId: string): Promise<void> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dispatch-stock:${hubId}`}))`;
  },

  /** Stock on hand at the Central Store location per item: the sum of the ledger. */
  onHand: async (hubId: string, locationId: string, itemIds: string[], db: Db = prisma): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const sums = await db.inventoryTransaction.groupBy({ by: ['inventoryItemId'], where: { siteId: hubId, locationId, inventoryItemId: { in: itemIds } }, _sum: { quantity: true } });
    return new Map(sums.map((s) => [s.inventoryItemId, s._sum.quantity ?? new Prisma.Decimal(0)]));
  },

  signDispatch: (
    tx: Db,
    id: string,
    data: { reference: string; packedById: string; signedById: string; signedAt: Date; carrierId: string; sendBatchId: string },
  ) =>
    tx.dispatch.update({
      where: { id },
      data: {
        status: 'ON_THE_WAY',
        reference: data.reference,
        packedById: data.packedById,
        packedAt: data.signedAt,
        signedById: data.signedById,
        signedAt: data.signedAt,
        carrierId: data.carrierId,
        sendBatchId: data.sendBatchId,
      },
    }),

  freezeLineCost: (tx: Db, lineId: string, unitCost: Prisma.Decimal) => tx.dispatchLine.update({ where: { id: lineId }, data: { unitCostAtDispatch: unitCost } }),

  /** The DISPATCH_OUT rows of a dispatch's lines that have not been reversed (cancel puts them back). */
  findOutRows: (tx: Db, lineIds: string[]) =>
    tx.inventoryTransaction.findMany({
      where: { dispatchLineId: { in: lineIds }, type: 'DISPATCH_OUT', reversesTransactionId: null, reversedBy: { is: null } },
      select: { id: true, dispatchLineId: true, locationId: true, inventoryItemId: true, quantity: true, unitCost: true },
    }),

  // --- Writes: cancel (P8) -------------------------------------------------------------------------------------------------

  /** Cancels only while ON_THE_WAY and uncounted; the row count says whether it won. */
  cancelDispatch: (tx: Db, id: string, data: { cancelledById: string; cancelledAt: Date; cancelReason: string }) =>
    tx.dispatch.updateMany({
      where: { id, status: 'ON_THE_WAY', countedAt: null },
      data: { status: 'CANCELLED', cancelledById: data.cancelledById, cancelledAt: data.cancelledAt, cancelReason: data.cancelReason },
    }),

  // --- Events (idempotency and the file's Activity) -------------------------------------------------------------------------

  /** A signing write that already ran with this key by this person on this requisition (any of its dispatches). */
  findEventByKey: (hubId: string, requisitionId: string, actorId: string, idempotencyKey: string, type: string, db: Db = prisma) =>
    db.dispatchEvent.findFirst({
      where: { actorId, idempotencyKey, type, dispatch: { siteId: hubId, requisitionId } },
      select: { id: true, dispatchId: true, at: true, dispatch: { select: { sendBatchId: true } } },
      orderBy: { at: 'asc' },
    }),

  /** A cancel with this key by this person on this dispatch. */
  findDispatchEventByKey: (hubId: string, dispatchId: string, actorId: string, idempotencyKey: string, type: string, db: Db = prisma) =>
    db.dispatchEvent.findFirst({ where: { dispatchId, actorId, idempotencyKey, type, dispatch: { siteId: hubId } }, select: { id: true, at: true } }),

  createEvent: (tx: Db, data: { dispatchId: string; type: string; actorId: string; actorRoleLabel: string; reason?: string | null; idempotencyKey?: string | null; at?: Date }) =>
    tx.dispatchEvent.create({
      data: { dispatchId: data.dispatchId, type: data.type, actorId: data.actorId, actorRoleLabel: data.actorRoleLabel, reason: data.reason ?? null, idempotencyKey: data.idempotencyKey ?? null, ...(data.at ? { at: data.at } : {}) },
    }),

  // --- Small lookups ----------------------------------------------------------------------------------------------------------

  findBatch: (hubId: string, sendBatchId: string, db: Db = prisma) =>
    db.dispatch.findMany({
      where: { siteId: hubId, sendBatchId },
      select: {
        id: true,
        reference: true,
        departmentId: true,
        department: { select: { name: true, position: true } },
        signedAt: true,
        requisitionId: true,
        toSiteId: true,
        carrier: { select: { id: true, name: true, kind: true } },
        packedBy: { select: personSelect },
        signedBy: { select: personSelect },
        lines: { select: { requestedQty: true, sentQty: true } },
      },
      orderBy: { department: { position: 'asc' } },
    }),

  /** Heads and members of departments (for the "Signed and sent" push) are resolved by the notify layer; this gives the branch code for a reference. */
  findBranch: (siteId: string, db: Db = prisma) => db.site.findFirst({ where: { id: siteId, type: 'BRANCH' }, select: { id: true, name: true, code: true } }),

  findCarrier: (hubId: string, id: string, db: Db = prisma) => db.carrier.findFirst({ where: { id, siteId: hubId } }),

  /** The carriers the Attendant picks from at the review (they hold no `carriers.read`). */
  listActiveCarriers: (hubId: string, db: Db = prisma) => db.carrier.findMany({ where: { siteId: hubId, active: true }, orderBy: { name: 'asc' } }),

  findCategoryNames: async (ids: string[], db: Db = prisma): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await db.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  findDepartmentNames: async (ids: string[], db: Db = prisma): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await db.department.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  /** The requisition's header, whatever its status (a replayed sign may come after the requisition closed). */
  findRequisitionBasics: (requisitionId: string, db: Db = prisma) =>
    db.requisition.findFirst({ where: { id: requisitionId, site: { type: 'BRANCH' } }, select: { id: true, reference: true, site: { select: { id: true, name: true, code: true } } } }),

  findStaff: (userId: string, db: Db = prisma) =>
    db.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { id: true, name: true, role: true, siteId: true, isDepartmentHead: true, departmentId: true } }),
};
