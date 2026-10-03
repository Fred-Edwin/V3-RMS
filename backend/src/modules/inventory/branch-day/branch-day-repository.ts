import { Prisma, type BranchDayDepartmentStatus, type DepartmentTag, type GapReason } from '@prisma/client';
import { prisma } from '../../../config/database';

type Tx = Prisma.TransactionClient;

const dayInclude = {
  organization: { select: { id: true, name: true, address: true, city: true, phone: true } },
  closedBy: { select: { id: true, name: true } },
  departments: {
    include: {
      countedBy: { select: { id: true, name: true } },
      lines: true,
    },
  },
  reopens: { orderBy: { reopenedAt: 'asc' as const } },
} satisfies Prisma.BranchDayInclude;

export type BranchDayFull = Prisma.BranchDayGetPayload<{ include: typeof dayInclude }>;
export type BranchDayDepartmentFull = BranchDayFull['departments'][number];
export type BranchDayLineRow = BranchDayDepartmentFull['lines'][number];

const openingInclude = {
  acceptedBy: { select: { id: true, name: true } },
  lines: true,
} satisfies Prisma.DepartmentOpeningInclude;

export type OpeningFull = Prisma.DepartmentOpeningGetPayload<{ include: typeof openingInclude }>;

export type OpeningLineWrite = {
  inventoryItemId: string;
  prefilledQty: Prisma.Decimal;
  acceptedQty: Prisma.Decimal;
  overnightVariance: Prisma.Decimal;
  unitCost: Prisma.Decimal;
};

export type DepartmentItem = {
  id: string;
  name: string;
  usageUnit: string;
  currentCost: Prisma.Decimal;
};

export type LineWrite = {
  inventoryItemId: string;
  countedQty: Prisma.Decimal | null;
  expectedQty: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  reason: GapReason | null;
  reasonNote: string | null;
  reasonRequired: boolean;
};

export const branchDayRepository = {
  findByDate: async (organizationId: string, businessDate: Date): Promise<BranchDayFull | null> =>
    prisma.branchDay.findFirst({ where: { organizationId, businessDate }, include: dayInclude }),

  /** Org-scoped. Pass `null` only for the Director's cross-branch reopen. */
  findById: async (id: string, organizationId: string | null): Promise<BranchDayFull | null> =>
    prisma.branchDay.findFirst({ where: { id, ...(organizationId ? { organizationId } : {}) }, include: dayInclude }),

  /** The branch's department locations — one per department tag. */
  departmentLocations: async (organizationId: string) =>
    prisma.location.findMany({
      where: { organizationId, type: 'BRANCH_DEPARTMENT', isActive: true, departmentTag: { not: null } },
      select: { id: true, departmentTag: true, name: true },
    }),

  createDay: async (
    tx: Tx,
    input: { organizationId: string; businessDate: Date; reference: string; locations: { id: string; tag: DepartmentTag }[] },
  ): Promise<string> => {
    const day = await tx.branchDay.create({
      data: {
        organizationId: input.organizationId,
        businessDate: input.businessDate,
        reference: input.reference,
        departments: { create: input.locations.map((l) => ({ departmentTag: l.tag, locationId: l.id })) },
      },
      select: { id: true },
    });
    return day.id;
  },

  /**
   * Items a department counts: the hub-catalog items tagged for it, plus any
   * item that currently has stock there (a dispatch can land an untagged item;
   * leaving it uncounted would let it drift forever).
   */
  departmentItems: async (
    hubOrgId: string,
    branchOrgId: string,
    locationId: string,
    tag: DepartmentTag,
  ): Promise<DepartmentItem[]> => {
    const held = await prisma.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { organizationId: branchOrgId, locationId },
      _sum: { quantity: true },
      having: { quantity: { _sum: { not: 0 } } },
    });
    return prisma.inventoryItem.findMany({
      where: {
        organizationId: hubOrgId,
        deletedAt: null,
        OR: [{ departmentTags: { has: tag } }, { id: { in: held.map((h) => h.inventoryItemId) } }],
      },
      select: { id: true, name: true, usageUnit: true, currentCost: true },
      orderBy: { name: 'asc' },
    });
  },

  /** Catalog rows by id (hub catalog) — used to show a signed line whose item has since left the department's set. */
  itemsByIds: async (hubOrgId: string, ids: string[]): Promise<DepartmentItem[]> =>
    prisma.inventoryItem.findMany({
      where: { organizationId: hubOrgId, id: { in: ids } },
      select: { id: true, name: true, usageUnit: true, currentCost: true },
    }),

  /** On-hand per item at a location, leaving out this day's own close adjustments (and their reversals); `asOf` cuts off later movements. */
  onHandExcludingDay: async (
    branchOrgId: string,
    locationId: string,
    itemIds: string[],
    dayLineIds: string[],
    asOf?: Date,
  ): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await prisma.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: {
        organizationId: branchOrgId,
        locationId,
        inventoryItemId: { in: itemIds },
        OR: [{ branchDayLineId: null }, { branchDayLineId: { notIn: dayLineIds } }],
        // A past day is judged against the position at the end of that business day, not against today's ledger.
        ...(asOf ? { createdAt: { lt: asOf } } : {}),
      },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, r._sum.quantity ?? new Prisma.Decimal(0)]));
  },

  /** Cost carried into the department: the latest dispatch-in cost per item. Callers fall back to the catalog cost. */
  latestInboundCosts: async (branchOrgId: string, locationId: string, itemIds: string[]): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await prisma.$queryRaw<{ item_id: string; unit_cost: Prisma.Decimal }[]>`
      SELECT DISTINCT ON (t.inventory_item_id) t.inventory_item_id AS item_id, t.unit_cost
      FROM inventory_transactions t
      WHERE t.organization_id = ${branchOrgId}
        AND t.location_id = ${locationId}
        AND t.type = 'DISPATCH_IN'
        AND t.inventory_item_id IN (${Prisma.join(itemIds)})
      ORDER BY t.inventory_item_id, t.created_at DESC`;
    return new Map(rows.map((r) => [r.item_id, new Prisma.Decimal(r.unit_cost)]));
  },

  /** Unconfirmed dispatches into this branch — what blocks a department (plan §1.4, derived, never stored). */
  inTransitDispatches: async (branchOrgId: string) =>
    prisma.dispatch.findMany({
      where: { toOrganizationId: branchOrgId, status: 'IN_TRANSIT' },
      select: { id: true, departmentTag: true, sequenceLabel: true },
      orderBy: { dispatchedAt: 'asc' },
    }),

  upsertLines: async (tx: Tx, departmentId: string, lines: LineWrite[]): Promise<void> => {
    for (const line of lines) {
      const data = {
        countedQty: line.countedQty,
        expectedQty: line.expectedQty,
        unitCost: line.unitCost,
        reason: line.reason,
        reasonNote: line.reasonNote,
        reasonRequired: line.reasonRequired,
      };
      await tx.branchDayLine.upsert({
        where: { branchDayDepartmentId_inventoryItemId: { branchDayDepartmentId: departmentId, inventoryItemId: line.inventoryItemId } },
        create: { branchDayDepartmentId: departmentId, inventoryItemId: line.inventoryItemId, ...data },
        update: data,
      });
    }
  },

  setDepartmentStatus: async (
    tx: Tx,
    departmentId: string,
    status: BranchDayDepartmentStatus,
    countedById: string | null,
    countedAt: Date | null,
  ): Promise<void> => {
    await tx.branchDayDepartment.update({ where: { id: departmentId }, data: { status, countedById, countedAt } });
  },

  /** Every adjustment the previous close wrote that has not itself been reversed — the re-close reverses these. */
  activeAdjustments: async (tx: Tx, branchOrgId: string, dayLineIds: string[]) =>
    dayLineIds.length === 0
      ? []
      : tx.inventoryTransaction.findMany({
          where: {
            organizationId: branchOrgId,
            branchDayLineId: { in: dayLineIds },
            type: 'ADJUSTMENT',
            reversesTransactionId: null,
            reversedBy: null,
          },
          orderBy: { createdAt: 'asc' },
        }),

  writeAdjustment: async (
    tx: Tx,
    input: {
      organizationId: string;
      locationId: string;
      inventoryItemId: string;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      reason: string | null;
      branchDayLineId?: string;
      openingLineId?: string;
      reference: string;
      userId: string;
      reversesTransactionId?: string;
    },
  ): Promise<void> => {
    await tx.inventoryTransaction.create({ data: { type: 'ADJUSTMENT', ...input } });
  },

  // ── History (Session 4) ───────────────────────────────────────────────────

  /** Closed days in range, plus any earlier day still open (a day nobody closed). Never today's open day. */
  historyDays: async (organizationId: string, from: Date, to: Date, today: Date): Promise<BranchDayFull[]> =>
    prisma.branchDay.findMany({
      where: {
        organizationId,
        businessDate: { gte: from, lte: to },
        OR: [{ status: 'CLOSED' }, { businessDate: { lt: today } }],
      },
      include: dayInclude,
      orderBy: { businessDate: 'desc' },
    }),

  reopenAudit: async (branchDayId: string) =>
    prisma.branchDayReopen.findMany({
      where: { branchDayId },
      include: { reopenedBy: { select: { id: true, name: true } } },
      orderBy: { reopenedAt: 'asc' },
    }),

  // ── Next-morning opening (Session 4) ──────────────────────────────────────

  /** On-hand per item at a location; `excludeOpeningLineIds` leaves out an opening's own overnight rows. */
  onHandAt: async (
    tx: Tx | null,
    branchOrgId: string,
    locationId: string,
    itemIds: string[],
    excludeOpeningLineIds: string[] = [],
  ): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const client = tx ?? prisma;
    const rows = await client.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: {
        organizationId: branchOrgId,
        locationId,
        inventoryItemId: { in: itemIds },
        ...(excludeOpeningLineIds.length > 0
          ? { OR: [{ openingLineId: null }, { openingLineId: { notIn: excludeOpeningLineIds } }] }
          : {}),
      },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, r._sum.quantity ?? new Prisma.Decimal(0)]));
  },

  findOpening: async (branchDayId: string, departmentTag: DepartmentTag): Promise<OpeningFull | null> =>
    prisma.departmentOpening.findFirst({ where: { branchDayId, departmentTag }, include: openingInclude }),

  createOpening: async (
    tx: Tx,
    input: { branchDayId: string; departmentTag: DepartmentTag; locationId: string; acceptedById: string; acceptedAt: Date; lines: OpeningLineWrite[] },
  ) =>
    tx.departmentOpening.create({
      data: {
        branchDayId: input.branchDayId,
        departmentTag: input.departmentTag,
        locationId: input.locationId,
        acceptedById: input.acceptedById,
        acceptedAt: input.acceptedAt,
        lines: { create: input.lines },
      },
      include: { lines: true },
    }),

  /** Openings already accepted for the given day (the recompute hook's input). */
  openingsForDate: async (tx: Tx, organizationId: string, businessDate: Date) =>
    tx.departmentOpening.findMany({
      where: { branchDay: { organizationId, businessDate } },
      include: { lines: true },
    }),

  updateOpeningLine: async (tx: Tx, id: string, prefilledQty: Prisma.Decimal, overnightVariance: Prisma.Decimal): Promise<void> => {
    await tx.departmentOpeningLine.update({ where: { id }, data: { prefilledQty, overnightVariance } });
  },

  /** Overnight adjustments an opening has left standing (not reversed, not themselves reversals). */
  activeOpeningAdjustments: async (tx: Tx, branchOrgId: string, openingLineIds: string[]) =>
    openingLineIds.length === 0
      ? []
      : tx.inventoryTransaction.findMany({
          where: {
            organizationId: branchOrgId,
            openingLineId: { in: openingLineIds },
            type: 'ADJUSTMENT',
            reversesTransactionId: null,
            reversedBy: null,
          },
          orderBy: { createdAt: 'asc' },
        }),

  closeDay: async (tx: Tx, id: string, closedById: string, closedAt: Date): Promise<void> => {
    await tx.branchDay.update({ where: { id }, data: { status: 'CLOSED', closedById, closedAt } });
  },

  reopenDay: async (tx: Tx, id: string, reopenedById: string, reason: string): Promise<{ reopenCount: number }> => {
    await tx.branchDayReopen.create({ data: { branchDayId: id, reopenedById, reason } });
    const day = await tx.branchDay.update({
      where: { id },
      data: { status: 'OPEN', closedAt: null, closedById: null, reopenCount: { increment: 1 } },
      select: { reopenCount: true },
    });
    return day;
  },
};
