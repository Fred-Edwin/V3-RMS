import { Prisma, type DiscrepancyFinding, type DiscrepancyStatus } from '@prisma/client';
import { prisma } from '../../../config/database';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Discrepancies: database access only, no rules. A Discrepancy belongs to the HUB (`siteId`, column `organization_id`) and to the
 * branch that counted (`toSiteId`); every query names the hub, a Branch Manager adds their branch and a head adds their department.
 */
export interface DiscrepancyScope {
  hubId: string;
  /** Set for a Branch Manager: only this branch. */
  toSiteId?: string;
  /** Set for a department head: only this department's deliveries. */
  departmentId?: string;
}

const scopeWhere = (s: DiscrepancyScope): Prisma.DiscrepancyWhereInput => ({
  siteId: s.hubId,
  ...(s.toSiteId ? { toSiteId: s.toSiteId } : {}),
  ...(s.departmentId ? { dispatch: { departmentId: s.departmentId } } : {}),
});

const personSelect = { id: true, name: true, role: true } as const;

export const HELD: DiscrepancyStatus[] = ['OPEN', 'REVERSED'];
export const SETTLED: DiscrepancyStatus[] = ['RECORDED'];

export interface ListFilter {
  statuses: DiscrepancyStatus[];
  branchId?: string;
  departmentId?: string;
  q?: string;
  from?: Date;
  to?: Date;
}

const filterWhere = (f: Omit<ListFilter, 'statuses'>): Prisma.DiscrepancyWhereInput => ({
  ...(f.branchId ? { toSiteId: f.branchId } : {}),
  ...(f.departmentId ? { dispatch: { departmentId: f.departmentId } } : {}),
  ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
  ...(f.q
    ? { OR: [{ reference: { contains: f.q, mode: 'insensitive' as const } }, { dispatchLine: { item: { name: { contains: f.q, mode: 'insensitive' as const } } } }] }
    : {}),
});

const rowSelect = {
  id: true,
  reference: true,
  status: true,
  gapQty: true,
  finding: true,
  findingNote: true,
  recordedAt: true,
  lossValue: true,
  createdAt: true,
  reminderSentAt: true,
  recordedBy: { select: personSelect },
  dispatch: { select: { id: true, reference: true, toSite: { select: { id: true, name: true, code: true } }, department: { select: { id: true, name: true } } } },
  dispatchLine: { select: { countReason: true, item: { select: { name: true, usageUnit: true } } } },
} satisfies Prisma.DiscrepancySelect;

export type DiscrepancyRowRecord = Prisma.DiscrepancyGetPayload<{ select: typeof rowSelect }>;

const fileInclude = {
  recordedBy: { select: personSelect },
  reversedBy: { select: personSelect },
  events: { include: { actor: { select: personSelect } }, orderBy: [{ at: 'asc' as const }, { id: 'asc' as const }] },
  dispatch: {
    select: {
      id: true,
      reference: true,
      requisitionId: true,
      status: true,
      packedAt: true,
      signedAt: true,
      countedAt: true,
      onBehalf: true,
      departmentId: true,
      toSite: { select: { id: true, name: true, code: true } },
      requisition: { select: { id: true, reference: true } },
      department: { select: { id: true, name: true } },
      packedBy: { select: personSelect },
      signedBy: { select: personSelect },
      countedBy: { select: { ...personSelect, isDepartmentHead: true, departmentId: true } },
      carrier: { select: { id: true, name: true } },
    },
  },
  dispatchLine: {
    select: {
      id: true,
      inventoryItemId: true,
      sentQty: true,
      countedQty: true,
      countedTwice: true,
      countReason: true,
      countReasonNote: true,
      unitCostAtDispatch: true,
      item: { select: { id: true, name: true, usageUnit: true, currentCost: true } },
      photos: { select: { id: true }, orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
    },
  },
} satisfies Prisma.DiscrepancyInclude;

export type DiscrepancyRecord = Prisma.DiscrepancyGetPayload<{ include: typeof fileInclude }>;

export const discrepanciesRepository = {
  // --- Reads -----------------------------------------------------------------------------------------------------------------

  list: async (scope: DiscrepancyScope, f: ListFilter, page: { skip: number; take: number }, db: Db = prisma): Promise<{ rows: DiscrepancyRowRecord[]; total: number }> => {
    const where: Prisma.DiscrepancyWhereInput = { AND: [scopeWhere(scope), filterWhere(f), { status: { in: f.statuses } }] };
    const open = f.statuses.includes('OPEN');
    const [rows, total] = await Promise.all([
      db.discrepancy.findMany({ where, select: rowSelect, orderBy: open ? [{ createdAt: 'asc' }, { id: 'asc' }] : [{ recordedAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.take }),
      db.discrepancy.count({ where }),
    ]);
    return { rows, total };
  },

  /** The two tab counts under the same scope and filters, whatever tab is showing. */
  counts: async (scope: DiscrepancyScope, f: Omit<ListFilter, 'statuses'>, db: Db = prisma): Promise<{ open: number; settled: number }> => {
    const base = { AND: [scopeWhere(scope), filterWhere(f)] };
    const [open, settled] = await Promise.all([
      db.discrepancy.count({ where: { AND: [...base.AND, { status: { in: HELD } }] } }),
      db.discrepancy.count({ where: { AND: [...base.AND, { status: { in: SETTLED } }] } }),
    ]);
    return { open, settled };
  },

  /** The active branches of the company, for the hub roles' branch picker. */
  listBranches: (db: Db = prisma) => db.site.findMany({ where: { isActive: true, isHub: false }, select: { id: true, name: true, code: true }, orderBy: { createdAt: 'asc' } }),

  findFile: (id: string, scope: DiscrepancyScope, db: Db = prisma): Promise<DiscrepancyRecord | null> =>
    db.discrepancy.findFirst({ where: { id, ...scopeWhere(scope) }, include: fileInclude }),

  findStaff: (userId: string, db: Db = prisma) =>
    db.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null }, select: { id: true, name: true, role: true, siteId: true, isDepartmentHead: true, departmentId: true } }),

  /** A signing write that already ran with this key by this person on this discrepancy. */
  findEventByKey: (hubId: string, discrepancyId: string, actorId: string, idempotencyKey: string, type: string, db: Db = prisma) =>
    db.discrepancyEvent.findFirst({
      where: { discrepancyId, actorId, idempotencyKey, type, discrepancy: { siteId: hubId } },
      select: { id: true, at: true, finding: true, note: true, reason: true },
    }),

  /** The ADJUSTMENT rows a recorded finding posted for this line that no reversal has undone yet. */
  findActiveAdjustments: (tx: Db, dispatchLineId: string) =>
    tx.inventoryTransaction.findMany({
      where: { dispatchLineId, type: 'ADJUSTMENT', reversesTransactionId: null, reversedBy: { is: null } },
      select: { id: true, locationId: true, inventoryItemId: true, quantity: true, unitCost: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),

  findDepartmentLocation: (siteId: string, departmentId: string, db: Db = prisma): Promise<{ id: string; name: string } | null> =>
    db.location.findFirst({ where: { siteId, type: 'BRANCH_DEPARTMENT', departmentId, isActive: true }, select: { id: true, name: true } }),

  // --- Writes ------------------------------------------------------------------------------------------------------------------

  /** Serialises the writes of one discrepancy (a finding racing a reversal, two Store Managers). Released at commit. */
  lock: async (tx: Db, id: string): Promise<void> => {
    await tx.$queryRaw`SELECT id FROM discrepancies WHERE id = ${id} FOR UPDATE`;
  },

  /** Records the finding only while the gap is held; the row count says whether this call won. */
  claimFinding: async (
    tx: Db,
    id: string,
    hubId: string,
    data: { finding: DiscrepancyFinding; note: string | null; recordedById: string; recordedAt: Date; lossValue: Prisma.Decimal | null },
  ): Promise<boolean> =>
    (
      await tx.discrepancy.updateMany({
        where: { id, siteId: hubId, status: { in: HELD } },
        data: { status: 'RECORDED', finding: data.finding, findingNote: data.note, recordedById: data.recordedById, recordedAt: data.recordedAt, lossValue: data.lossValue },
      })
    ).count > 0,

  /** Reverses only a recorded finding: the status goes straight back to OPEN (Amendment 1 row 7) and the clock for the reminder restarts. */
  claimReversal: async (tx: Db, id: string, hubId: string, data: { reversedById: string; reversedAt: Date; reason: string }): Promise<boolean> =>
    (
      await tx.discrepancy.updateMany({
        where: { id, siteId: hubId, status: 'RECORDED' },
        data: {
          status: 'OPEN',
          finding: null,
          findingNote: null,
          recordedById: null,
          recordedAt: null,
          lossValue: null,
          reversedById: data.reversedById,
          reversedAt: data.reversedAt,
          reverseReason: data.reason,
          reminderSentAt: null,
        },
      })
    ).count > 0,

  createEvent: (
    tx: Db,
    data: { discrepancyId: string; type: string; actorId: string; actorRoleLabel: string; finding?: DiscrepancyFinding | null; note?: string | null; reason?: string | null; idempotencyKey?: string | null; at?: Date },
  ) =>
    tx.discrepancyEvent.create({
      data: {
        discrepancyId: data.discrepancyId,
        type: data.type,
        actorId: data.actorId,
        actorRoleLabel: data.actorRoleLabel,
        finding: data.finding ?? null,
        note: data.note ?? null,
        reason: data.reason ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
        ...(data.at ? { at: data.at } : {}),
      },
    }),

  /** A reversal puts a CLOSED dispatch back to CONFIRMED: the gap is held again. */
  reopenDispatch: async (tx: Db, dispatchId: string, hubId: string): Promise<boolean> =>
    (await tx.dispatch.updateMany({ where: { id: dispatchId, siteId: hubId, status: 'CLOSED' }, data: { status: 'CONFIRMED', closedAt: null } })).count > 0,

  // --- The 24-hour reminder job ---------------------------------------------------------------------------------------------------

  /** Gaps held for at least `olderThan` that have had no reminder in the last `olderThan` (the job re-checks the exact clock). */
  findReminderCandidates: (hubId: string, olderThan: Date, db: Db = prisma) =>
    db.discrepancy.findMany({
      where: {
        siteId: hubId,
        status: { in: HELD },
        AND: [{ OR: [{ reversedAt: null, createdAt: { lte: olderThan } }, { reversedAt: { lte: olderThan } }] }, { OR: [{ reminderSentAt: null }, { reminderSentAt: { lte: olderThan } }] }],
      },
      select: {
        id: true,
        reference: true,
        createdAt: true,
        reversedAt: true,
        reminderSentAt: true,
        toSiteId: true,
        gapQty: true,
        dispatchLine: { select: { item: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),

  /** The job's claim: stamps the reminder only if nobody else did since `olderThan`; the row count says whether this run owns the send. */
  claimReminder: async (id: string, hubId: string, at: Date, olderThan: Date, db: Db = prisma): Promise<boolean> =>
    (
      await db.discrepancy.updateMany({
        where: { id, siteId: hubId, status: { in: HELD }, OR: [{ reminderSentAt: null }, { reminderSentAt: { lte: olderThan } }] },
        data: { reminderSentAt: at },
      })
    ).count > 0,
};
