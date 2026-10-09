import { Prisma, type WasteReason, type WasteReversalReason } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { KpiLog } from './branch-kpis';
import { branchWasteLogInclude, type BranchWasteLogRow } from './branch-row';
import type { BranchItemRow } from './branch-view';

type Tx = Prisma.TransactionClient;
type Client = Tx | typeof prisma;

/** Whose entries a read may reach: these branches (`siteId`), and when set only this department's. Every query carries it. */
export type WasteScope = { siteIds: string[]; departmentId?: string };

/** What narrows the list page: the filters of W6 and W8 (the date range is the Nairobi day `from` to the day after `to`). */
export type WasteFilter = { search?: string; departmentId?: string; reason?: WasteReason; status?: 'logged' | 'reversed'; loggedFrom?: Date; loggedBefore?: Date };

export type LoggableItem = { id: string; name: string; usageUnit: string; currentCost: Prisma.Decimal; deletedAt: Date | null; inDepartment: boolean };

export type CreateBranchWasteLogData = {
  siteId: string;
  locationId: string;
  batchId: string;
  inventoryItemId: string;
  quantity: Prisma.Decimal;
  reason: WasteReason;
  note: string | null;
  unitCost: Prisma.Decimal;
  loggedById: string;
};

/** Branch waste is the waste of a branch's department locations (never the Central Store's), inside the caller's reach. */
const scopeWhere = (scope: WasteScope): Prisma.WasteLogWhereInput => ({
  siteId: { in: scope.siteIds },
  location: { type: 'BRANCH_DEPARTMENT', ...(scope.departmentId ? { departmentId: scope.departmentId } : {}) },
});

const filterWhere = (filter: WasteFilter): Prisma.WasteLogWhereInput => ({
  ...(filter.departmentId ? { location: { departmentId: filter.departmentId } } : {}),
  ...(filter.reason ? { reason: filter.reason } : {}),
  ...(filter.status === 'logged' ? { reversedAt: null } : filter.status === 'reversed' ? { reversedAt: { not: null } } : {}),
  ...(filter.loggedFrom || filter.loggedBefore
    ? { createdAt: { ...(filter.loggedFrom ? { gte: filter.loggedFrom } : {}), ...(filter.loggedBefore ? { lt: filter.loggedBefore } : {}) } }
    : {}),
  ...(filter.search
    ? {
        OR: [
          { inventoryItem: { name: { contains: filter.search, mode: 'insensitive' as const } } },
          { loggedBy: { name: { contains: filter.search, mode: 'insensitive' as const } } },
        ],
      }
    : {}),
});

const kpiSelect = {
  createdAt: true,
  reversedAt: true,
  quantity: true,
  unitCost: true,
  reason: true,
  siteId: true,
  inventoryItemId: true,
  inventoryItem: { select: { name: true } },
  location: { select: { departmentId: true, department: { select: { id: true, name: true } } } },
  reversedBy: { select: { id: true, name: true, departmentId: true } },
} satisfies Prisma.WasteLogSelect;

export const branchWasteRepository = {
  // --- Who is calling -------------------------------------------------------------------------------------------------------------

  /** The caller as the department rule reads them: their branch, department and whether that department is still active. */
  findStaff: (userId: string, client: Client = prisma) =>
    client.user.findFirst({
      where: { id: userId, isActive: true, deletedAt: null },
      select: { id: true, name: true, role: true, siteId: true, departmentId: true, department: { select: { id: true, name: true, siteId: true, status: true } } },
    }),

  // --- The picker (BW1) -----------------------------------------------------------------------------------------------------------

  /** Live catalog items (the catalog is the hub's) linked to the department, by name, optionally matching a search. */
  searchDepartmentItems: (hubId: string, departmentId: string, search: string | undefined, limit: number): Promise<BranchItemRow[]> =>
    prisma.inventoryItem.findMany({
      where: { siteId: hubId, deletedAt: null, departments: { some: { departmentId } }, ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) },
      select: { id: true, name: true, usageUnit: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit,
    }),

  /** Live items of the department by id, in the order given. Retired or unlinked items never appear. */
  departmentItemsByIds: async (hubId: string, departmentId: string, ids: string[]): Promise<BranchItemRow[]> => {
    if (ids.length === 0) return [];
    const rows = await prisma.inventoryItem.findMany({
      where: { siteId: hubId, deletedAt: null, id: { in: ids }, departments: { some: { departmentId } } },
      select: { id: true, name: true, usageUnit: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  },

  /** This caller's most logged items in the department since `since`, most logged first (ties: the most recent). */
  oftenItemIds: async (siteId: string, userId: string, departmentId: string, since: Date, limit: number): Promise<string[]> => {
    // Plain SQL: Prisma's groupBy cannot filter on the location's department without making `created_at` ambiguous.
    const rows = await prisma.$queryRaw<Array<{ itemId: string }>>`
      SELECT w.inventory_item_id AS "itemId"
      FROM waste_logs w
      JOIN locations l ON l.id = w.location_id
      WHERE w.organization_id = ${siteId} AND w.logged_by_id = ${userId} AND w.created_at >= ${since} AND l.department_id = ${departmentId}
      GROUP BY w.inventory_item_id
      ORDER BY COUNT(*) DESC, MAX(w.created_at) DESC
      LIMIT ${limit * 2}`;
    return rows.map((row) => row.itemId);
  },

  // --- Logging (BW2) --------------------------------------------------------------------------------------------------------------

  /** Catalog items by id (live or retired) with whether the department holds each, so the service can tell the three refusals apart. */
  findLoggableItems: async (hubId: string, departmentId: string, ids: string[]): Promise<LoggableItem[]> => {
    const rows = await prisma.inventoryItem.findMany({
      where: { siteId: hubId, id: { in: ids } },
      select: { id: true, name: true, usageUnit: true, currentCost: true, deletedAt: true, departments: { where: { departmentId }, select: { departmentId: true } } },
    });
    return rows.map(({ departments, ...item }) => ({ ...item, inDepartment: departments.length > 0 }));
  },

  /** The batch a caller already sent under this key in this branch, with its entries, oldest first. */
  findBatch: (siteId: string, userId: string, idempotencyKey: string, client: Client = prisma) =>
    client.wasteBatch.findUnique({
      where: { siteId_userId_idempotencyKey: { siteId, userId, idempotencyKey } },
      include: { logs: { include: branchWasteLogInclude, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    }),

  createBatch: (tx: Tx, siteId: string, userId: string, idempotencyKey: string): Promise<{ id: string }> =>
    tx.wasteBatch.create({ data: { siteId, userId, idempotencyKey }, select: { id: true } }),

  createLog: (tx: Tx, data: CreateBranchWasteLogData): Promise<BranchWasteLogRow> => tx.wasteLog.create({ data, include: branchWasteLogInclude }),

  /** The cost carried into a department: the latest DISPATCH_IN row's unit cost for this item at this location. Null if none. */
  latestDispatchInCost: async (siteId: string, locationId: string, inventoryItemId: string, client: Client = prisma): Promise<Prisma.Decimal | null> => {
    const row = await client.inventoryTransaction.findFirst({
      where: { siteId, locationId, inventoryItemId, type: 'DISPATCH_IN' },
      orderBy: { createdAt: 'desc' },
      select: { unitCost: true },
    });
    return row?.unitCost ?? null;
  },

  // --- Reading (BW3 to BW6) -------------------------------------------------------------------------------------------------------

  findPage: async (scope: WasteScope, filter: WasteFilter, page: number, pageSize: number): Promise<{ rows: BranchWasteLogRow[]; total: number }> => {
    const where: Prisma.WasteLogWhereInput = { AND: [scopeWhere(scope), filterWhere(filter)] };
    const [rows, total] = await Promise.all([
      prisma.wasteLog.findMany({ where, include: branchWasteLogInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      prisma.wasteLog.count({ where }),
    ]);
    return { rows, total };
  },

  /** One entry, only if it sits inside the caller's reach. */
  findLog: (id: string, scope: WasteScope, client: Client = prisma): Promise<BranchWasteLogRow | null> =>
    client.wasteLog.findFirst({ where: { AND: [{ id }, scopeWhere(scope)] }, include: branchWasteLogInclude }),

  /** The Department filter's options: every department of these branches, retired ones too (their entries remain), by branch then position. */
  departmentsOf: (siteIds: string[]) =>
    prisma.department.findMany({
      where: { siteId: { in: siteIds } },
      select: { id: true, name: true },
      orderBy: [{ siteId: 'asc' }, { position: 'asc' }, { name: 'asc' }],
    }),

  /** The caller's most recent entry in the department today and how many entries sit in its batch: "2 items logged at 14:20". */
  latestBatchToday: async (siteId: string, userId: string, departmentId: string, todayStart: Date): Promise<{ at: Date; count: number } | null> => {
    const latest = await prisma.wasteLog.findFirst({
      where: { siteId, loggedById: userId, createdAt: { gte: todayStart }, location: { departmentId } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { createdAt: true, batchId: true },
    });
    if (!latest) return null;
    const count = latest.batchId ? await prisma.wasteLog.count({ where: { siteId, batchId: latest.batchId } }) : 1;
    return { at: latest.createdAt, count };
  },

  /** The ledger rows an entry wrote, oldest first: the log, then a reversal if there is one (BW6 for those who may see stock). */
  ledgerRowsOf: (siteId: string, wasteLogId: string) =>
    prisma.inventoryTransaction.findMany({
      where: { siteId, wasteLogId, type: 'WASTE' },
      select: { quantity: true, createdAt: true, reversesTransactionId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),

  /** Whether any of these items now holds less than zero in the department's location (flagged, never blocked). */
  anyNegative: async (siteId: string, locationId: string, itemIds: string[], client: Client = prisma): Promise<boolean> => {
    if (itemIds.length === 0) return false;
    const rows = await client.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { siteId, locationId, inventoryItemId: { in: itemIds } },
      _sum: { quantity: true },
    });
    return rows.some((row) => (row._sum.quantity ?? new Prisma.Decimal(0)).isNegative());
  },

  // --- The four figures -----------------------------------------------------------------------------------------------------------

  /** Every entry logged since `since` (any status) inside the scope, for the figures. */
  loggedSince: (scope: WasteScope, since: Date): Promise<KpiLog[]> => prisma.wasteLog.findMany({ where: { AND: [scopeWhere(scope), { createdAt: { gte: since } }] }, select: kpiSelect }),

  /** Every entry reversed since `since`, whenever it was logged. */
  reversedSince: (scope: WasteScope, since: Date): Promise<KpiLog[]> => prisma.wasteLog.findMany({ where: { AND: [scopeWhere(scope), { reversedAt: { gte: since } }] }, select: kpiSelect }),

  // --- Reversing (BW7) ------------------------------------------------------------------------------------------------------------

  /** Holds the entry's row until the transaction ends, so two people reversing it at once cannot both pass the checks. */
  lockLog: async (tx: Tx, siteId: string, id: string): Promise<void> => {
    await tx.$queryRaw`SELECT id FROM waste_logs WHERE id = ${id} AND organization_id = ${siteId} FOR UPDATE`;
  },

  /** The entry's own WASTE ledger row: the one that is not itself a reversal. */
  findWasteLedgerRow: (tx: Tx, siteId: string, wasteLogId: string) =>
    tx.inventoryTransaction.findFirst({
      where: { siteId, wasteLogId, type: 'WASTE', reversesTransactionId: null },
      select: { id: true, locationId: true, inventoryItemId: true, quantity: true, unitCost: true },
    }),

  stampReversal: async (
    tx: Tx,
    siteId: string,
    id: string,
    data: { reversedAt: Date; reversedById: string; reversalReason: WasteReversalReason; reversalNote: string | null },
  ): Promise<BranchWasteLogRow> => {
    await tx.wasteLog.updateMany({ where: { id, siteId, reversedAt: null }, data });
    return tx.wasteLog.findFirstOrThrow({ where: { id, siteId }, include: branchWasteLogInclude });
  },
};
