import { Prisma, type BranchDayCorrectionReason, type BranchDaySheetKind, type DepartmentTag, type OpeningKind } from '@prisma/client';
import { prisma } from '../../../config/database';

/**
 * Branch day, Prisma only (contract §5). Every query is scoped by the branch (`siteId`, column `organization_id`): a reader of many
 * branches passes the ids it may reach, never nothing. Functions take the caller's transaction client where a service wraps them in
 * `prisma.$transaction`, and fall back to the shared client for plain reads.
 */
export type Db = Prisma.TransactionClient | typeof prisma;

const PERSON = { select: { id: true, name: true, role: true } } as const;

const dayInclude = {
  site: { select: { id: true, name: true, code: true, address: true, phone: true } },
  closedBy: PERSON,
  departments: {
    orderBy: [{ department: { position: 'asc' as const } }, { createdAt: 'asc' as const }],
    include: {
      department: { select: { id: true, name: true, status: true, position: true } },
      location: { select: { id: true } },
      countedBy: PERSON,
      lines: {
        include: {
          inventoryItem: { select: { id: true, name: true, usageUnit: true, currentCost: true, categoryId: true, category: { select: { id: true, name: true, parentCategoryId: true } } } },
          corrections: { orderBy: { correctedAt: 'asc' as const }, include: { correctedBy: PERSON } },
        },
      },
    },
  },
  openings: { include: { acceptedBy: PERSON, lines: true } },
} satisfies Prisma.BranchDayInclude;

export type DayRecord = Prisma.BranchDayGetPayload<{ include: typeof dayInclude }>;
export type DepartmentRow = DayRecord['departments'][number];
export type LineRow = DepartmentRow['lines'][number];
export type OpeningRow = DayRecord['openings'][number];
export type CorrectionRow = LineRow['corrections'][number];

export type Person = { id: string; name: string; role: string };
export type StaffRow = { id: string; name: string; role: string; siteId: string | null; isDepartmentHead: boolean; departmentId: string | null };
export type SiteRow = { id: string; name: string; code: string | null; isHub: boolean };
export type DepartmentInfo = { id: string; name: string; key: DepartmentTag | null };
export type ItemInfo = { id: string; name: string; usageUnit: string; currentCost: Prisma.Decimal; categoryId: string | null };

const byItem = <T extends { inventoryItemId: string; _sum: { quantity: Prisma.Decimal | null } }>(rows: T[]): Map<string, Prisma.Decimal> =>
  new Map(rows.map((r) => [r.inventoryItemId, r._sum.quantity ?? new Prisma.Decimal(0)]));

export const branchDayRepository = {
  // --- People and places -----------------------------------------------------------------------------------------------------------

  findStaff: (userId: string, db: Db = prisma): Promise<StaffRow | null> =>
    db.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      select: { id: true, name: true, role: true, siteId: true, isDepartmentHead: true, departmentId: true },
    }),

  findSite: (siteId: string, db: Db = prisma): Promise<SiteRow | null> => db.site.findFirst({ where: { id: siteId }, select: { id: true, name: true, code: true, isHub: true } }),

  /** Active branches (the hub is a Central Store, never a branch), by name: the picker and the "reach" of a reader of every branch. */
  activeBranches: (db: Db = prisma): Promise<{ id: string; name: string; code: string | null }[]> =>
    db.site.findMany({ where: { isActive: true, isHub: false }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),

  findBranchForSheet: (siteId: string, db: Db = prisma) =>
    db.site.findFirst({ where: { id: siteId }, select: { id: true, name: true, code: true, address: true, phone: true } }),

  /** The branch's ACTIVE departments, in their order. */
  activeDepartments: (siteId: string, db: Db = prisma): Promise<DepartmentInfo[]> =>
    db.department.findMany({ where: { siteId, status: 'ACTIVE' }, select: { id: true, name: true, key: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),

  /** A department of the branch with its status (a retired one cannot count). */
  findDepartment: (siteId: string, departmentId: string, db: Db = prisma) =>
    db.department.findFirst({ where: { id: departmentId, siteId }, select: { id: true, name: true, key: true, status: true } }),

  /** The department heads of a branch, by department (an active head; the first when several). */
  departmentHeads: async (siteId: string, departmentIds: string[], db: Db = prisma): Promise<Map<string, Person>> => {
    if (departmentIds.length === 0) return new Map();
    const rows = await db.user.findMany({
      where: { siteId, departmentId: { in: departmentIds }, isDepartmentHead: true, isActive: true, deletedAt: null },
      select: { id: true, name: true, role: true, departmentId: true },
      orderBy: { name: 'asc' },
    });
    const heads = new Map<string, Person>();
    for (const r of rows) if (r.departmentId && !heads.has(r.departmentId)) heads.set(r.departmentId, { id: r.id, name: r.name, role: r.role });
    return heads;
  },

  /** The items a department holds, live ones only (`item_departments`), by name. */
  itemsOfDepartment: async (departmentId: string, db: Db = prisma): Promise<ItemInfo[]> => {
    const rows = await db.itemDepartment.findMany({
      where: { departmentId, item: { deletedAt: null } },
      select: { item: { select: { id: true, name: true, usageUnit: true, currentCost: true, categoryId: true } } },
    });
    return rows.map((r) => r.item).sort((a, b) => a.name.localeCompare(b.name));
  },

  categoryNames: async (ids: string[], db: Db = prisma): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await db.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  // --- The day -----------------------------------------------------------------------------------------------------------------------

  findDayByDate: (siteId: string, businessDate: Date, db: Db = prisma): Promise<DayRecord | null> =>
    db.branchDay.findFirst({ where: { siteId, businessDate }, include: dayInclude }),

  /** One day by id inside the branches the caller may reach. */
  findDayById: (siteIds: string[], id: string, db: Db = prisma): Promise<DayRecord | null> =>
    db.branchDay.findFirst({ where: { id, siteId: { in: siteIds } }, include: dayInclude }),

  /** Row lock for a close or a correction (contract §5.8, §5.10). Scoped by the branch. */
  lockDay: async (tx: Prisma.TransactionClient, siteId: string, id: string): Promise<boolean> => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM branch_days WHERE id = ${id} AND organization_id = ${siteId} FOR UPDATE`;
    return rows.length > 0;
  },

  createDay: async (
    tx: Prisma.TransactionClient,
    input: { siteId: string; businessDate: Date; reference: string; departments: { departmentId: string; tag: DepartmentTag | null; locationId: string }[] },
  ): Promise<{ id: string; departments: { id: string; departmentId: string | null }[] }> =>
    tx.branchDay.create({
      data: {
        siteId: input.siteId,
        businessDate: input.businessDate,
        reference: input.reference,
        departments: { create: input.departments.map((d) => ({ departmentId: d.departmentId, departmentTag: d.tag, locationId: d.locationId })) },
      },
      select: { id: true, departments: { select: { id: true, departmentId: true } } },
    }),

  /** One line per item for a department's day; a line that already exists is left alone. */
  addLines: async (tx: Prisma.TransactionClient, branchDayDepartmentId: string, items: { id: string; cost: Prisma.Decimal }[]): Promise<void> => {
    if (items.length === 0) return;
    await tx.branchDayLine.createMany({
      data: items.map((i) => ({ branchDayDepartmentId, inventoryItemId: i.id, unitCost: i.cost })),
      skipDuplicates: true,
    });
  },

  /** A department row of an adopted old day that has no id link yet (the back-fill could not match it). */
  linkDepartment: async (tx: Prisma.TransactionClient, id: string, departmentId: string): Promise<void> => {
    await tx.branchDayDepartment.updateMany({ where: { id, departmentId: null }, data: { departmentId } });
  },

  /** Adoption of an open day the old code made: a department that was marked counted with a blank line goes back to not counted, so the head recounts blind. */
  reopenPartialCount: async (tx: Prisma.TransactionClient, id: string): Promise<void> => {
    await tx.branchDayDepartment.updateMany({ where: { id, status: 'COUNTED' }, data: { status: 'NOT_STARTED', countedById: null, countedAt: null } });
  },

  // --- Stock facts (the ledger, waste, deliveries) --------------------------------------------------------------------------------------

  /** The ledger position per item at a location, optionally only the rows created before `before`. */
  positions: async (siteId: string, locationId: string, itemIds: string[], before: Date | null, db: Db = prisma): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await db.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { siteId, locationId, inventoryItemId: { in: itemIds }, ...(before ? { createdAt: { lt: before } } : {}) },
      _sum: { quantity: true },
    });
    return byItem(rows);
  },

  /** What the department counted and confirmed in the window: the `DISPATCH_IN` rows at its location. */
  received: async (siteId: string, locationId: string, itemIds: string[], start: Date, end: Date, db: Db = prisma): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await db.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { siteId, locationId, type: 'DISPATCH_IN', inventoryItemId: { in: itemIds }, createdAt: { gte: start, lt: end } },
      _sum: { quantity: true },
    });
    return byItem(rows);
  },

  /** Waste logged at the department's location in the window; a reversed entry counts for nothing. */
  waste: async (siteId: string, locationId: string, itemIds: string[], start: Date, end: Date, db: Db = prisma): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await db.wasteLog.groupBy({
      by: ['inventoryItemId'],
      where: { siteId, locationId, inventoryItemId: { in: itemIds }, reversedAt: null, createdAt: { gte: start, lt: end } },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, r._sum.quantity ?? new Prisma.Decimal(0)]));
  },

  /** The waste entries behind the Waste column ("Eggs, damaged in store"). */
  wasteEntries: (siteId: string, locationId: string, start: Date, end: Date, db: Db = prisma) =>
    db.wasteLog.findMany({
      where: { siteId, locationId, reversedAt: null, createdAt: { gte: start, lt: end } },
      select: { id: true, reason: true, inventoryItem: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),

  /** The cost carried into the department: the latest `DISPATCH_IN` cost per item. Callers fall back to the item's current cost. */
  latestInboundCosts: async (siteId: string, locationId: string, itemIds: string[], db: Db = prisma): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await db.$queryRaw<{ item_id: string; unit_cost: Prisma.Decimal }[]>`
      SELECT DISTINCT ON (t.inventory_item_id) t.inventory_item_id AS item_id, t.unit_cost
      FROM inventory_transactions t
      WHERE t.organization_id = ${siteId}
        AND t.location_id = ${locationId}
        AND t.type = 'DISPATCH_IN'
        AND t.inventory_item_id IN (${Prisma.join(itemIds)})
      ORDER BY t.inventory_item_id, t.created_at DESC`;
    return new Map(rows.map((r) => [r.item_id, new Prisma.Decimal(r.unit_cost)]));
  },

  /** Last night's signed figure: per item, the closing figure (as corrected) on the department's latest earlier CLOSED day. */
  previousClosing: async (siteId: string, departmentId: string, itemIds: string[], before: Date, db: Db = prisma) => {
    if (itemIds.length === 0) return new Map<string, { qty: Prisma.Decimal; closedAt: Date | null }>();
    const rows = await db.branchDayLine.findMany({
      where: {
        inventoryItemId: { in: itemIds },
        countedQty: { not: null },
        department: { departmentId, branchDay: { siteId, status: 'CLOSED', businessDate: { lt: before } } },
      },
      select: { inventoryItemId: true, countedQty: true, department: { select: { branchDay: { select: { businessDate: true, closedAt: true } } } } },
      orderBy: { department: { branchDay: { businessDate: 'desc' } } },
    });
    const out = new Map<string, { qty: Prisma.Decimal; closedAt: Date | null }>();
    for (const r of rows) {
      if (r.countedQty !== null && !out.has(r.inventoryItemId)) out.set(r.inventoryItemId, { qty: r.countedQty, closedAt: r.department.branchDay.closedAt });
    }
    return out;
  },

  /** When the branch's latest earlier closed day closed (the opening check's "signed when the day closed"). */
  previousClosedAt: async (siteId: string, before: Date, db: Db = prisma): Promise<Date | null> => {
    const row = await db.branchDay.findFirst({ where: { siteId, status: 'CLOSED', businessDate: { lt: before } }, orderBy: { businessDate: 'desc' }, select: { closedAt: true } });
    return row?.closedAt ?? null;
  },

  /** The frozen Used today of the department's items on the day dated `date`, when that day is closed. */
  usedOn: async (siteId: string, departmentId: string, itemIds: string[], date: Date, db: Db = prisma): Promise<Map<string, Prisma.Decimal>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await db.branchDayLine.findMany({
      where: { inventoryItemId: { in: itemIds }, usedQty: { not: null }, department: { departmentId, branchDay: { siteId, status: 'CLOSED', businessDate: date } } },
      select: { inventoryItemId: true, usedQty: true },
    });
    return new Map(rows.flatMap((r) => (r.usedQty !== null ? [[r.inventoryItemId, r.usedQty] as const] : [])));
  },

  /** Dispatches to the branch that left the store and are not yet confirmed (they block the close). */
  onTheWay: (siteId: string, db: Db = prisma) =>
    db.dispatch.findMany({
      where: { toSiteId: siteId, status: 'ON_THE_WAY' },
      select: { id: true, reference: true, signedAt: true, department: { select: { id: true, name: true } } },
      orderBy: [{ signedAt: 'asc' }, { id: 'asc' }],
    }),

  /** Open discrepancies of the branch (they never block). */
  openDiscrepancies: (siteId: string, db: Db = prisma) =>
    db.discrepancy.findMany({
      where: { toSiteId: siteId, status: 'OPEN' },
      select: { id: true, reference: true, dispatch: { select: { departmentId: true } }, dispatchLine: { select: { item: { select: { name: true } } } }, dispatchId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),

  /** Today's deliveries to the departments: on the way, or confirmed inside the window, with their discrepancies. */
  deliveriesInWindow: (siteId: string, start: Date, end: Date, db: Db = prisma) =>
    db.dispatch.findMany({
      where: { toSiteId: siteId, OR: [{ status: 'ON_THE_WAY' }, { status: { in: ['CONFIRMED', 'CLOSED'] }, countedAt: { gte: start, lt: end } }] },
      select: {
        id: true,
        reference: true,
        status: true,
        departmentId: true,
        countedAt: true,
        discrepancies: { select: { id: true, status: true } },
      },
      orderBy: [{ signedAt: 'asc' }, { id: 'asc' }],
    }),

  // --- Openings ------------------------------------------------------------------------------------------------------------------------

  createOpening: (
    tx: Prisma.TransactionClient,
    input: {
      branchDayId: string;
      departmentId: string;
      departmentTag: DepartmentTag | null;
      locationId: string;
      acceptedById: string;
      acceptedAt: Date;
      kind: OpeningKind;
      onBehalf: boolean;
      idempotencyKey: string;
      lines: { inventoryItemId: string; prefilledQty: Prisma.Decimal; acceptedQty: Prisma.Decimal; overnightVariance: Prisma.Decimal; unitCost: Prisma.Decimal }[];
    },
  ) =>
    tx.departmentOpening.create({
      data: {
        branchDayId: input.branchDayId,
        departmentId: input.departmentId,
        departmentTag: input.departmentTag,
        locationId: input.locationId,
        acceptedById: input.acceptedById,
        acceptedAt: input.acceptedAt,
        kind: input.kind,
        onBehalf: input.onBehalf,
        idempotencyKey: input.idempotencyKey,
        lines: { create: input.lines },
      },
      include: { acceptedBy: PERSON, lines: true },
    }),

  /** Has this department an accepted opening on a LATER day of the branch? (closes the correction window, §5.10) */
  laterOpeningExists: async (siteId: string, departmentId: string, businessDate: Date, db: Db = prisma): Promise<boolean> =>
    (await db.departmentOpening.count({ where: { departmentId, branchDay: { siteId, businessDate: { gt: businessDate } } } })) > 0,

  // --- The count -------------------------------------------------------------------------------------------------------------------------

  /** Stores what was typed on lines of this department's day (last write wins; null clears). */
  saveCounts: async (tx: Prisma.TransactionClient, branchDayDepartmentId: string, lines: { id: string; countedQty: Prisma.Decimal | null }[]): Promise<void> => {
    for (const line of lines) {
      await tx.branchDayLine.updateMany({ where: { id: line.id, branchDayDepartmentId }, data: { countedQty: line.countedQty } });
    }
  },

  /** Marks the department counted; false when it already was (a race lost to another signer). */
  signDepartment: async (
    tx: Prisma.TransactionClient,
    input: { id: string; branchDayId: string; countedById: string; countedAt: Date; onBehalf: boolean; idempotencyKey: string },
  ): Promise<boolean> => {
    const result = await tx.branchDayDepartment.updateMany({
      where: { id: input.id, branchDayId: input.branchDayId, status: 'NOT_STARTED' },
      data: { status: 'COUNTED', countedById: input.countedById, countedAt: input.countedAt, onBehalf: input.onBehalf, countIdempotencyKey: input.idempotencyKey },
    });
    return result.count === 1;
  },

  // --- The close and a correction ------------------------------------------------------------------------------------------------------

  freezeLine: async (
    tx: Prisma.TransactionClient,
    id: string,
    data: { openingQty: Prisma.Decimal; receivedQty: Prisma.Decimal; wasteQty: Prisma.Decimal; usedQty: Prisma.Decimal | null; unitCost: Prisma.Decimal },
  ): Promise<void> => {
    await tx.branchDayLine.update({ where: { id }, data });
  },

  closeDay: async (
    tx: Prisma.TransactionClient,
    input: { id: string; siteId: string; closedById: string; closedAt: Date; usedValue: Prisma.Decimal; closingValue: Prisma.Decimal; idempotencyKey: string },
  ): Promise<void> => {
    await tx.branchDay.updateMany({
      where: { id: input.id, siteId: input.siteId, status: 'OPEN' },
      data: {
        status: 'CLOSED',
        closedById: input.closedById,
        closedAt: input.closedAt,
        usedValue: input.usedValue,
        closingValue: input.closingValue,
        closeIdempotencyKey: input.idempotencyKey,
      },
    });
  },

  updateLineFigures: async (tx: Prisma.TransactionClient, id: string, countedQty: Prisma.Decimal, usedQty: Prisma.Decimal): Promise<void> => {
    await tx.branchDayLine.update({ where: { id }, data: { countedQty, usedQty } });
  },

  updateDayTotals: async (tx: Prisma.TransactionClient, id: string, siteId: string, usedValue: Prisma.Decimal, closingValue: Prisma.Decimal): Promise<void> => {
    await tx.branchDay.updateMany({ where: { id, siteId }, data: { usedValue, closingValue } });
  },

  createCorrection: (
    tx: Prisma.TransactionClient,
    input: {
      branchDayId: string;
      branchDayLineId: string;
      fromClosingQty: Prisma.Decimal;
      toClosingQty: Prisma.Decimal;
      fromUsedQty: Prisma.Decimal;
      toUsedQty: Prisma.Decimal;
      reason: BranchDayCorrectionReason;
      note: string | null;
      correctedById: string;
      correctedAt: Date;
      transactionId: string;
      sheetVersion: number;
      idempotencyKey: string;
    },
  ) => tx.branchDayCorrection.create({ data: input, include: { correctedBy: PERSON } }),

  findCorrectionByKey: (branchDayId: string, idempotencyKey: string, db: Db = prisma) =>
    db.branchDayCorrection.findFirst({
      where: { branchDayId, idempotencyKey },
      include: { correctedBy: PERSON, branchDayLine: { select: { id: true, department: { select: { departmentId: true } } } } },
    }),

  // --- The day sheet -------------------------------------------------------------------------------------------------------------------

  latestSheetVersion: async (branchDayId: string, db: Db = prisma): Promise<number> => {
    const row = await db.branchDaySheet.findFirst({ where: { branchDayId }, orderBy: { version: 'desc' }, select: { version: true } });
    return row?.version ?? 0;
  },

  createSheet: (tx: Prisma.TransactionClient, input: { branchDayId: string; version: number; kind: BranchDaySheetKind; pages: number; payload: Prisma.InputJsonValue; createdById: string }) =>
    tx.branchDaySheet.create({ data: input, select: { id: true, version: true, kind: true, pages: true, createdAt: true } }),

  listSheets: (branchDayId: string, db: Db = prisma) =>
    db.branchDaySheet.findMany({ where: { branchDayId }, select: { id: true, version: true, kind: true, pages: true, createdAt: true }, orderBy: { version: 'desc' } }),

  /** One stored sheet: the version asked for, else the latest. */
  findSheet: (branchDayId: string, version: number | undefined, db: Db = prisma) =>
    db.branchDaySheet.findFirst({
      where: { branchDayId, ...(version !== undefined ? { version } : {}) },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, kind: true, pages: true, payload: true, createdAt: true },
    }),

  // --- History, mine, entries ------------------------------------------------------------------------------------------------------------

  listHistory: async (
    siteIds: string[],
    filter: { q?: string; from?: Date; to?: Date; status?: 'OPEN' | 'CLOSED' | 'CORRECTED' },
    skip: number,
    take: number,
    db: Db = prisma,
  ) => {
    const where: Prisma.BranchDayWhereInput = {
      siteId: { in: siteIds },
      ...(filter.from || filter.to ? { businessDate: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } } : {}),
      ...(filter.q ? { reference: { contains: filter.q, mode: 'insensitive' as const } } : {}),
      ...(filter.status === 'OPEN' ? { status: 'OPEN' as const } : {}),
      ...(filter.status === 'CLOSED' ? { status: 'CLOSED' as const, corrections: { none: {} } } : {}),
      ...(filter.status === 'CORRECTED' ? { status: 'CLOSED' as const, corrections: { some: {} } } : {}),
    };
    const [rows, total] = await Promise.all([
      db.branchDay.findMany({
        where,
        select: {
          id: true,
          reference: true,
          businessDate: true,
          status: true,
          closedAt: true,
          usedValue: true,
          closingValue: true,
          site: { select: { id: true, name: true, code: true } },
          closedBy: PERSON,
          departments: { select: { status: true, _count: { select: { lines: true } } } },
          _count: { select: { corrections: true } },
        },
        orderBy: [{ businessDate: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      db.branchDay.count({ where }),
    ]);
    return { rows, total };
  },

  /** The department's own closed days (chapter 5, step 19): the rows where it signed a count. */
  listMine: async (siteId: string, departmentId: string, filter: { from?: Date; to?: Date; status?: 'CLOSED' | 'CORRECTED' }, skip: number, take: number, db: Db = prisma) => {
    const where: Prisma.BranchDayDepartmentWhereInput = {
      departmentId,
      status: 'COUNTED',
      branchDay: {
        siteId,
        status: 'CLOSED',
        ...(filter.from || filter.to ? { businessDate: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } } : {}),
      },
      ...(filter.status === 'CORRECTED' ? { lines: { some: { corrections: { some: {} } } } } : {}),
      ...(filter.status === 'CLOSED' ? { lines: { none: { corrections: { some: {} } } } } : {}),
    };
    const [rows, total] = await Promise.all([
      db.branchDayDepartment.findMany({
        where,
        select: {
          id: true,
          countedAt: true,
          branchDay: { select: { id: true, reference: true, businessDate: true } },
          _count: { select: { lines: { where: { countedQty: { not: null } } } } },
          lines: { select: { corrections: { select: { id: true } } } },
        },
        orderBy: [{ branchDay: { businessDate: 'desc' } }, { id: 'desc' }],
        skip,
        take,
      }),
      db.branchDayDepartment.count({ where }),
    ]);
    return { rows, total };
  },

  /** The ledger entries carrying the day number: the usage entries and the corrections, newest first. */
  entriesPage: async (siteId: string, reference: string, skip: number, take: number, db: Db = prisma) => {
    const where: Prisma.InventoryTransactionWhereInput = { siteId, reference, branchDayLineId: { not: null } };
    const [rows, total] = await Promise.all([
      db.inventoryTransaction.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          quantity: true,
          reference: true,
          inventoryItem: { select: { name: true, usageUnit: true } },
          branchDayLine: { select: { department: { select: { department: { select: { id: true, name: true } } } } } },
          branchDayCorrection: { select: { id: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      db.inventoryTransaction.count({ where }),
    ]);
    return { rows, total };
  },

  /** The first entries of a day in the order the close wrote them (department order, then item name), for B9's "Showing 5 of 41". */
  firstEntries: (siteId: string, reference: string, take: number, db: Db = prisma) =>
    db.inventoryTransaction.findMany({
      where: { siteId, reference, branchDayLineId: { not: null }, branchDayCorrection: null },
      select: {
        id: true,
        createdAt: true,
        quantity: true,
        reference: true,
        inventoryItem: { select: { name: true, usageUnit: true } },
        branchDayLine: { select: { department: { select: { department: { select: { id: true, name: true, position: true } } } } } },
      },
      orderBy: [{ branchDayLine: { department: { department: { position: 'asc' } } } }, { inventoryItem: { name: 'asc' } }],
      take,
    }),

  usageEntryCount: (siteId: string, reference: string, db: Db = prisma): Promise<number> =>
    db.inventoryTransaction.count({ where: { siteId, reference, branchDayLineId: { not: null }, branchDayCorrection: null } }),

  findEntry: (siteId: string, id: string, db: Db = prisma) =>
    db.inventoryTransaction.findFirst({
      where: { id, siteId },
      select: {
        id: true,
        createdAt: true,
        quantity: true,
        reference: true,
        inventoryItem: { select: { name: true, usageUnit: true } },
        branchDayLine: { select: { department: { select: { department: { select: { id: true, name: true } } } } } },
      },
    }),
};
