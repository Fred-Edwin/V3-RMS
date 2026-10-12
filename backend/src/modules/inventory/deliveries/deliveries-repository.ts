import { Prisma, type DispatchCountReason, type DispatchStatus } from '@prisma/client';
import { prisma } from '../../../config/database';
import type { DeliveryResult } from '../dispatch/_shared/dispatch-contract';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Deliveries: database access only, no rules. A Dispatch belongs to the HUB (`siteId`, column `organization_id`) and is addressed to
 * a branch (`toSiteId`); every query names both, and a head or member adds their own department. The Branch Manager's scope is the
 * branch alone.
 */
export interface DeliveryScope {
  hubId: string;
  toSiteId: string;
  /** Set for a head or member: only their own department's deliveries. */
  departmentId?: string;
}

const scopeWhere = (s: DeliveryScope): Prisma.DispatchWhereInput => ({
  siteId: s.hubId,
  toSiteId: s.toSiteId,
  ...(s.departmentId ? { departmentId: s.departmentId } : {}),
});

const personSelect = { id: true, name: true, role: true } as const;

const rowSelect = {
  id: true,
  reference: true,
  status: true,
  signedAt: true,
  arrivedAt: true,
  countedAt: true,
  onBehalf: true,
  department: { select: { id: true, name: true } },
  carrier: { select: { id: true, name: true, kind: true } },
  requisition: { select: { type: true } },
  countedBy: { select: { ...personSelect, isDepartmentHead: true, departmentId: true } },
  lines: { select: { id: true, countedQty: true } },
  discrepancies: { select: { status: true } },
} satisfies Prisma.DispatchSelect;

export type DeliveryRowRecord = Prisma.DispatchGetPayload<{ select: typeof rowSelect }>;

const itemSelect = { id: true, name: true, usageUnit: true, currentCost: true, category: { select: { id: true, name: true, parentCategoryId: true } } } as const;

const countInclude = {
  toSite: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true } },
  requisition: { select: { id: true, reference: true } },
  countedBy: { select: personSelect },
  lines: {
    include: { item: { select: itemSelect }, photos: { select: { id: true }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] } },
    orderBy: [{ item: { name: 'asc' as const } }, { id: 'asc' as const }],
  },
  discrepancies: { select: { id: true, reference: true, status: true, gapQty: true, dispatchLineId: true } },
} satisfies Prisma.DispatchInclude;

export type DeliveryRecord = Prisma.DispatchGetPayload<{ include: typeof countInclude }>;
export type DeliveryLineRecord = DeliveryRecord['lines'][number];

export interface ListFilter {
  statuses: DispatchStatus[];
  from?: Date;
  to?: Date;
  /** Which date the range runs on: the signature while waiting, the count once counted. */
  dateField: 'signedAt' | 'countedAt';
  result?: DeliveryResult;
  skip: number;
  take: number;
}

const resultWhere = (result: DeliveryResult): Prisma.DispatchWhereInput => {
  switch (result) {
    case 'MATCHED':
      return { discrepancies: { none: {} } };
    case 'GAP_OPEN':
      return { discrepancies: { some: { status: { not: 'RECORDED' } } } };
    case 'GAP_RESOLVED':
    default:
      return { AND: [{ discrepancies: { some: {} } }, { discrepancies: { none: { status: { not: 'RECORDED' } } } }] };
  }
};

export const deliveriesRepository = {
  // --- Reads -----------------------------------------------------------------------------------------------------------------

  list: async (scope: DeliveryScope, f: ListFilter, db: Db = prisma): Promise<{ rows: DeliveryRowRecord[]; total: number }> => {
    const where: Prisma.DispatchWhereInput = {
      ...scopeWhere(scope),
      status: { in: f.statuses },
      ...(f.from || f.to ? { [f.dateField]: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
      ...(f.result ? resultWhere(f.result) : {}),
    };
    const [rows, total] = await Promise.all([
      db.dispatch.findMany({ where, select: rowSelect, orderBy: [{ [f.dateField]: 'desc' }, { id: 'desc' }], skip: f.skip, take: f.take }),
      db.dispatch.count({ where }),
    ]);
    return { rows, total };
  },

  count: (scope: DeliveryScope, statuses: DispatchStatus[], db: Db = prisma): Promise<number> =>
    db.dispatch.count({ where: { ...scopeWhere(scope), status: { in: statuses } } }),

  /** One delivery with its lines, photos and discrepancies. Whether it is the caller's department is the service's rule. */
  findForCount: (id: string, scope: Pick<DeliveryScope, 'hubId' | 'toSiteId'>, db: Db = prisma): Promise<DeliveryRecord | null> =>
    db.dispatch.findFirst({ where: { id, siteId: scope.hubId, toSiteId: scope.toSiteId }, include: countInclude }),

  /** The branch-department stock location a counted quantity lands in (none for a department added after the five were provisioned). */
  findDepartmentLocation: (siteId: string, departmentId: string, db: Db = prisma): Promise<{ id: string } | null> =>
    db.location.findFirst({ where: { siteId, type: 'BRANCH_DEPARTMENT', departmentId, isActive: true }, select: { id: true } }),

  /**
   * The department's stock location, created on first use when it has none (a department added after the five were provisioned has no
   * location until something lands in it). The legacy `departmentTag` is kept in step with the department's `key`, as the expand
   * phase requires. Idempotent: a second call finds the one the first made.
   */
  ensureDepartmentLocation: async (tx: Db, siteId: string, departmentId: string): Promise<{ id: string } | null> => {
    const existing = await tx.location.findFirst({ where: { siteId, type: 'BRANCH_DEPARTMENT', departmentId, isActive: true }, select: { id: true } });
    if (existing) return existing;
    const department = await tx.department.findFirst({ where: { id: departmentId, siteId }, select: { id: true, name: true, key: true, site: { select: { name: true } } } });
    if (!department) return null;
    return tx.location.create({
      data: { siteId, type: 'BRANCH_DEPARTMENT', departmentId: department.id, departmentTag: department.key, name: `${department.site.name} — ${department.name}` },
      select: { id: true },
    });
  },

  findCategoryNames: async (ids: string[], db: Db = prisma): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await db.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  findStaff: (userId: string, db: Db = prisma) =>
    db.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { id: true, name: true, role: true, siteId: true, isDepartmentHead: true, departmentId: true } }),

  /** A confirm that already ran with this key by this person on this delivery. */
  findConfirmEvent: (hubId: string, dispatchId: string, actorId: string, idempotencyKey: string, db: Db = prisma) =>
    db.dispatchEvent.findFirst({
      where: { dispatchId, actorId, idempotencyKey, type: { in: ['DELIVERY_CONFIRMED', 'DELIVERY_CONFIRMED_ON_BEHALF'] }, dispatch: { siteId: hubId } },
      select: { id: true, at: true },
    }),

  // --- The 2-hour "Waiting for the branch" job ---------------------------------------------------------------------------------

  /** Deliveries signed at or before `cutoff` that nobody has counted and the Branch Manager has not been told about. */
  findWaitingCandidates: (hubId: string, cutoff: Date, db: Db = prisma) =>
    db.dispatch.findMany({
      where: { siteId: hubId, status: 'ON_THE_WAY', countedAt: null, waitingNotifiedAt: null, signedAt: { lte: cutoff } },
      select: { id: true, reference: true, toSiteId: true, department: { select: { name: true } } },
      orderBy: [{ signedAt: 'asc' }, { id: 'asc' }],
    }),

  /** The job's claim: stamps the notice only for one run; the row count says whether this run owns the send. */
  claimWaiting: async (id: string, hubId: string, at: Date, cutoff: Date, db: Db = prisma): Promise<boolean> =>
    (
      await db.dispatch.updateMany({
        where: { id, siteId: hubId, status: 'ON_THE_WAY', countedAt: null, waitingNotifiedAt: null, signedAt: { lte: cutoff } },
        data: { waitingNotifiedAt: at },
      })
    ).count > 0,

  // --- Writes: the draft count ---------------------------------------------------------------------------------------------

  /** Serialises the writes of one delivery (two members signing, a save racing a check). Released at commit. */
  lockDispatch: async (tx: Db, id: string): Promise<void> => {
    await tx.$queryRaw`SELECT id FROM dispatches WHERE id = ${id} FOR UPDATE`;
  },

  /** Stamps `arrivedAt` the first time anyone opens the delivery; the row count says whether this read was the first. */
  stampArrived: async (id: string, hubId: string, at: Date, db: Db = prisma): Promise<boolean> =>
    (await db.dispatch.updateMany({ where: { id, siteId: hubId, status: 'ON_THE_WAY', arrivedAt: null }, data: { arrivedAt: at } })).count > 0,

  saveCount: (tx: Db, lineId: string, countedQty: Prisma.Decimal) => tx.dispatchLine.update({ where: { id: lineId }, data: { countedQty } }),

  applyCheck: (tx: Db, lineId: string, data: { checkCount: number; countedTwice?: boolean }) =>
    tx.dispatchLine.update({ where: { id: lineId }, data: { checkCount: data.checkCount, ...(data.countedTwice ? { countedTwice: true } : {}) } }),

  setReason: (tx: Db, lineId: string, reason: DispatchCountReason, note: string | null) =>
    tx.dispatchLine.update({ where: { id: lineId }, data: { countReason: reason, countReasonNote: note } }),

  // --- Writes: photos ----------------------------------------------------------------------------------------------------------

  countPhotos: (lineId: string, db: Db = prisma): Promise<number> => db.dispatchPhoto.count({ where: { dispatchLineId: lineId } }),

  createPhoto: (
    tx: Db,
    data: { hubId: string; lineId: string; objectKey: string; fileName: string; mimeType: string; sizeBytes: number; uploadedById: string },
  ) =>
    tx.dispatchPhoto.create({
      data: { siteId: data.hubId, dispatchLineId: data.lineId, objectKey: data.objectKey, fileName: data.fileName, mimeType: data.mimeType, sizeBytes: data.sizeBytes, uploadedById: data.uploadedById },
      select: { id: true },
    }),

  /** A photo with the delivery it belongs to, for the authenticated read and the delete. */
  findPhoto: (photoId: string, hubId: string, db: Db = prisma) =>
    db.dispatchPhoto.findFirst({
      where: { id: photoId, siteId: hubId },
      select: {
        id: true,
        objectKey: true,
        mimeType: true,
        fileName: true,
        dispatchLineId: true,
        line: { select: { dispatchId: true, dispatch: { select: { id: true, status: true, toSiteId: true, departmentId: true } } } },
      },
    }),

  listLinePhotos: (lineId: string, db: Db = prisma) =>
    db.dispatchPhoto.findMany({ where: { dispatchLineId: lineId }, select: { id: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),

  deletePhoto: (id: string, db: Db = prisma) => db.dispatchPhoto.delete({ where: { id } }),

  // --- Writes: the confirm (V6) --------------------------------------------------------------------------------------------------

  /** Confirms only while ON_THE_WAY; the row count says whether this call won (the two-signature race). */
  markConfirmed: async (tx: Db, id: string, data: { countedById: string; countedAt: Date; onBehalf: boolean }): Promise<boolean> =>
    (await tx.dispatch.updateMany({ where: { id, status: 'ON_THE_WAY' }, data: { status: 'CONFIRMED', countedById: data.countedById, countedAt: data.countedAt, onBehalf: data.onBehalf } })).count > 0,

  createDiscrepancy: (
    tx: Db,
    data: { hubId: string; toSiteId: string; dispatchId: string; dispatchLineId: string; reference: string; gapQty: Prisma.Decimal },
  ) =>
    tx.discrepancy.create({
      data: { siteId: data.hubId, toSiteId: data.toSiteId, dispatchId: data.dispatchId, dispatchLineId: data.dispatchLineId, reference: data.reference, gapQty: data.gapQty },
      select: { id: true, reference: true, gapQty: true },
    }),

  createDiscrepancyEvent: (tx: Db, data: { discrepancyId: string; type: string; actorId: string; actorRoleLabel: string; at: Date }) =>
    tx.discrepancyEvent.create({ data: { discrepancyId: data.discrepancyId, type: data.type, actorId: data.actorId, actorRoleLabel: data.actorRoleLabel, at: data.at } }),
};
