import { Prisma, type CountCause, type CountStatus, type UserRole } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { countReadsRepository } from '../_shared/count-reads-repository';
import { countRecordRepository } from '../_shared/count-record-repository';

type Client = typeof prisma | Prisma.TransactionClient;
type Person = { id: string; name: string; role: UserRole };

export type StatusFilter = 'all' | 'waiting' | 'inProgress' | 'approved';

const STATUS_OF: Record<Exclude<StatusFilter, 'all'>, CountStatus> = { waiting: 'SUBMITTED', inProgress: 'OPEN', approved: 'APPROVED' };

export type CountListRow = {
  id: string;
  reference: string;
  status: CountStatus;
  selfSigned: boolean;
  counter: Person;
  counterId: string;
  startedAt: Date;
  signedAt: Date | null;
  scopeNames: string[];
  firstItemNames: string[];
  itemsCounted: number;
  itemsTotal: number;
  exceeds: number;
  within: number;
  recountOf: { id: string; reference: string } | null;
};

/** One row of "My counts": a signed count of the caller's own. */
export type MyCountListRow = {
  id: string;
  reference: string;
  status: CountStatus;
  selfSigned: boolean;
  signedAt: Date;
  scopeNames: string[];
  firstItemNames: string[];
  itemCount: number;
};

export type SummaryFacts = {
  waiting: { count: number; latest: { sectionsText: string; signedAt: Date } | null };
  inProgress: { count: number; first: { sectionsText: string; counterName: string; counted: number; total: number } | null };
  exceeded: { lines: number; netKes: Prisma.Decimal };
  flaggedUnseen: number;
  repeatShortfalls: number;
};

export type FlaggedRow = {
  countId: string;
  countReference: string;
  lineId: string;
  itemName: string;
  unit: string;
  countedQty: Prisma.Decimal;
  expectedQty: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  cause: CountCause | null;
  countedBy: Person;
  alert: boolean;
  seenAt: Date | null;
  seenBy: Person | null;
};

export type RepeatRow = { itemId: string; itemName: string; unit: string; sectionName: string | null; shortRuns: number };
export type RepeatHistory = { itemId: string; countReference: string; difference: Prisma.Decimal; at: Date };

const PERSON = { select: { id: true, name: true, role: true } } as const;

/** The range a list is cut to, as instants: `startedFrom` included, `startedBefore` excluded (the start of the day after `to`). */
export type StartedRange = { startedFrom?: Date; startedBefore?: Date };
/**
 * A count waiting for approval (`SUBMITTED`) is always in the list, whatever the range (owner decision, 8 Oct 2026): it is work
 * someone has to do, and an old one must not hide behind the default 30 days. The rows, the total, and the chip numbers all use
 * this one rule, so they add up.
 */
const startedWhere = (range: StartedRange): Prisma.CountWhereInput =>
  range.startedFrom || range.startedBefore
    ? { OR: [{ status: 'SUBMITTED' }, { startedAt: { ...(range.startedFrom ? { gte: range.startedFrom } : {}), ...(range.startedBefore ? { lt: range.startedBefore } : {}) } }] }
    : {};

/** The Counts screens' reads. Every query carries `siteId`; nothing here writes. */
export const countsRepository = {
  ...countRecordRepository,
  unsectionedCount: (siteId: string, client: Client = prisma): Promise<number> => countReadsRepository.unsectionedCount(siteId, client),

  /** The Counts table: filtered by status chip, a date range on when the count started, and a search over reference, section and counter, newest first, one page. */
  list: async (
    siteId: string,
    filter: { status: StatusFilter; search?: string } & StartedRange,
    paging: { page: number; pageSize: number },
    client: Client = prisma,
  ): Promise<{ rows: CountListRow[]; total: number }> => {
    const where: Prisma.CountWhereInput = {
      siteId,
      // Both the date range and the search are an OR of their own, so they sit side by side in an AND.
      AND: [
        startedWhere(filter),
        ...(filter.search
          ? [
              {
                OR: [
                  { reference: { contains: filter.search, mode: 'insensitive' as const } },
                  { counter: { name: { contains: filter.search, mode: 'insensitive' as const } } },
                  { scopeSections: { some: { sectionName: { contains: filter.search, mode: 'insensitive' as const } } } },
                  { lines: { some: { inventoryItem: { name: { contains: filter.search, mode: 'insensitive' as const } } } } },
                ],
              },
            ]
          : []),
      ],
      ...(filter.status !== 'all' ? { status: STATUS_OF[filter.status] } : {}),
    };
    const [rows, total] = await Promise.all([
      client.count.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        skip: (paging.page - 1) * paging.pageSize,
        take: paging.pageSize,
        select: {
          id: true,
          reference: true,
          status: true,
          selfSigned: true,
          counterId: true,
          startedAt: true,
          signedAt: true,
          counter: PERSON,
          scopeSections: { orderBy: { sectionName: 'asc' }, select: { sectionName: true } },
          recountOfLine: { select: { count: { select: { id: true, reference: true } } } },
          lines: { orderBy: { position: 'asc' }, select: { countedQty: true, result: true, inventoryItem: { select: { name: true } } } },
        },
      }),
      client.count.count({ where }),
    ]);
    return {
      total,
      rows: rows.map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        selfSigned: r.selfSigned,
        counter: r.counter,
        counterId: r.counterId,
        startedAt: r.startedAt,
        signedAt: r.signedAt,
        scopeNames: r.scopeSections.map((s) => s.sectionName),
        firstItemNames: r.lines.slice(0, 3).map((l) => l.inventoryItem.name),
        itemsCounted: r.lines.filter((l) => l.countedQty !== null).length,
        itemsTotal: r.lines.length,
        exceeds: r.lines.filter((l) => l.result === 'EXCEEDS').length,
        within: r.lines.filter((l) => l.result === 'WITHIN_RANGE').length,
        recountOf: r.recountOfLine ? r.recountOfLine.count : null,
      })),
    };
  },

  /**
   * C32: one person's signed counts (SUBMITTED or APPROVED), newest signed first, one page. `counterId` is always the caller.
   * A count waiting for review (SUBMITTED) is in the list whatever the range, like C2; the status filter still applies on top.
   */
  mineList: async (
    siteId: string,
    counterId: string,
    filter: { status: 'all' | 'waiting' | 'approved'; signedFrom?: Date; signedBefore?: Date },
    paging: { page: number; pageSize: number },
    client: Client = prisma,
  ): Promise<{ rows: MyCountListRow[]; total: number }> => {
    const inRange: Prisma.CountWhereInput =
      filter.signedFrom || filter.signedBefore
        ? { OR: [{ status: 'SUBMITTED' }, { signedAt: { ...(filter.signedFrom ? { gte: filter.signedFrom } : {}), ...(filter.signedBefore ? { lt: filter.signedBefore } : {}) } }] }
        : {};
    const where: Prisma.CountWhereInput = {
      siteId,
      counterId,
      status: filter.status === 'waiting' ? 'SUBMITTED' : filter.status === 'approved' ? 'APPROVED' : { in: ['SUBMITTED', 'APPROVED'] },
      signedAt: { not: null },
      AND: [inRange],
    };
    const [rows, total] = await Promise.all([
      client.count.findMany({
        where,
        orderBy: [{ signedAt: 'desc' }, { id: 'desc' }],
        skip: (paging.page - 1) * paging.pageSize,
        take: paging.pageSize,
        select: {
          id: true,
          reference: true,
          status: true,
          selfSigned: true,
          signedAt: true,
          scopeSections: { orderBy: { sectionName: 'asc' }, select: { sectionName: true } },
          lines: { orderBy: { position: 'asc' }, take: 3, select: { inventoryItem: { select: { name: true } } } },
          _count: { select: { lines: true } },
        },
      }),
      client.count.count({ where }),
    ]);
    return {
      total,
      rows: rows.flatMap((r) =>
        r.signedAt
          ? [
              {
                id: r.id,
                reference: r.reference,
                status: r.status,
                selfSigned: r.selfSigned,
                signedAt: r.signedAt,
                scopeNames: r.scopeSections.map((s) => s.sectionName),
                firstItemNames: r.lines.map((l) => l.inventoryItem.name),
                itemCount: r._count.lines,
              },
            ]
          : [],
      ),
    };
  },

  /** C31: how many counts one person has signed, all time (the badge on My counts). */
  signedCountOf: (siteId: string, counterId: string, client: Client = prisma): Promise<number> =>
    client.count.count({ where: { siteId, counterId, status: { in: ['SUBMITTED', 'APPROVED'] }, signedAt: { not: null } } }),

  /** C31: waste entries one person logged in a window, reversed ones included (Waste's table, read here only to count). */
  wasteEntriesLogged: (siteId: string, loggedById: string, from: Date, before: Date, client: Client = prisma): Promise<number> =>
    client.wasteLog.count({ where: { siteId, loggedById, createdAt: { gte: from, lt: before } } }),

  /** The numbers on the status chips: they follow the date range, not the search or the chip itself. */
  chipCounts: async (siteId: string, client: Client = prisma, range: StartedRange = {}): Promise<{ all: number; waiting: number; inProgress: number; approved: number }> => {
    const grouped = await client.count.groupBy({ by: ['status'], where: { siteId, ...startedWhere(range) }, _count: { _all: true } });
    const n = (s: CountStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;
    return { all: grouped.reduce((t, g) => t + g._count._all, 0), waiting: n('SUBMITTED'), inProgress: n('OPEN'), approved: n('APPROVED') };
  },

  /** What the two KPI strips are drawn from. */
  summaryFacts: async (siteId: string, since: Date, client: Client = prisma): Promise<SummaryFacts> => {
    const countSelect = {
      reference: true,
      signedAt: true,
      scopeSections: { orderBy: { sectionName: 'asc' as const }, select: { sectionName: true } },
      lines: { orderBy: { position: 'asc' as const }, take: 3, select: { inventoryItem: { select: { name: true } } } },
    };
    const [waitingCount, latest, openCount, openFirst, exceeded, flaggedUnseen, repeat] = await Promise.all([
      client.count.count({ where: { siteId, status: 'SUBMITTED' } }),
      client.count.findFirst({ where: { siteId, status: 'SUBMITTED' }, orderBy: { signedAt: 'desc' }, select: countSelect }),
      client.count.count({ where: { siteId, status: 'OPEN' } }),
      client.count.findFirst({
        where: { siteId, status: 'OPEN' },
        orderBy: { startedAt: 'desc' },
        select: { ...countSelect, counter: { select: { name: true } }, lines: { select: { countedQty: true, inventoryItem: { select: { name: true } } }, orderBy: { position: 'asc' } } },
      }),
      client.$queryRaw<{ lines: number; net: Prisma.Decimal | null }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS lines, SUM((cl.counted_qty - cl.expected_qty) * cl.unit_cost) AS net
        FROM count_lines cl JOIN counts c ON c.id = cl.count_id
        WHERE cl.organization_id = ${siteId} AND cl.result = 'EXCEEDS'
          AND c.status IN ('SUBMITTED', 'APPROVED') AND c.signed_at >= ${since}`),
      client.countLine.count({ where: { siteId, directorFlagged: true, directorSeenAt: null } }),
      countsRepository.repeatCount(siteId, client),
    ]);
    const names = (c: { scopeSections: { sectionName: string }[]; lines: { inventoryItem: { name: string } }[] }) =>
      (c.scopeSections.length > 0 ? c.scopeSections.map((s) => s.sectionName) : c.lines.map((l) => l.inventoryItem.name)).join(', ');
    return {
      waiting: { count: waitingCount, latest: latest?.signedAt ? { sectionsText: names(latest), signedAt: latest.signedAt } : null },
      inProgress: {
        count: openCount,
        first: openFirst
          ? { sectionsText: names(openFirst), counterName: openFirst.counter.name, counted: openFirst.lines.filter((l) => l.countedQty !== null).length, total: openFirst.lines.length }
          : null,
      },
      exceeded: { lines: exceeded[0]?.lines ?? 0, netKes: new Prisma.Decimal(exceeded[0]?.net ?? 0) },
      flaggedUnseen,
      repeatShortfalls: repeat,
    };
  },

  /** Items whose LATEST signed line is short on three counts running or more. */
  repeatCount: async (siteId: string, client: Client = prisma): Promise<number> => (await countsRepository.repeatItems(siteId, { skip: 0, take: 100000 }, client)).total,

  repeatItems: async (siteId: string, paging: { skip: number; take: number }, client: Client = prisma): Promise<{ rows: RepeatRow[]; total: number }> => {
    const rows = await client.$queryRaw<{ item_id: string; name: string; unit: string; section_name: string | null; streak: number; total: number }[]>(Prisma.sql`
      SELECT * FROM (
        SELECT DISTINCT ON (cl.inventory_item_id) cl.inventory_item_id AS item_id, it.name, it.usage_unit AS unit, s.name AS section_name,
               cl.short_streak AS streak, c.signed_at
        FROM count_lines cl
        JOIN counts c ON c.id = cl.count_id
        JOIN inventory_items it ON it.id = cl.inventory_item_id AND it.deleted_at IS NULL
        LEFT JOIN count_section_items i ON i.inventory_item_id = it.id
        LEFT JOIN count_sections s ON s.id = i.section_id
        WHERE cl.organization_id = ${siteId} AND cl.counted_qty IS NOT NULL AND cl.expected_qty IS NOT NULL
          AND c.status IN ('SUBMITTED', 'APPROVED') AND c.signed_at IS NOT NULL
        ORDER BY cl.inventory_item_id, c.signed_at DESC
      ) latest
      WHERE streak >= 3
      ORDER BY streak DESC, name ASC`);
    return {
      total: rows.length,
      rows: rows.slice(paging.skip, paging.skip + paging.take).map((r) => ({ itemId: r.item_id, itemName: r.name, unit: r.unit, sectionName: r.section_name, shortRuns: r.streak })),
    };
  },

  /** The last three signed counts of each item that counted it, newest first (the repeat-shortfall rows). */
  lastCountsOf: async (siteId: string, itemIds: string[], client: Client = prisma): Promise<RepeatHistory[]> => {
    if (itemIds.length === 0) return [];
    const rows = await client.$queryRaw<{ item_id: string; reference: string; difference: Prisma.Decimal; at: Date }[]>(Prisma.sql`
      SELECT item_id, reference, difference, at FROM (
        SELECT cl.inventory_item_id AS item_id, c.reference, (cl.counted_qty - cl.expected_qty) AS difference, c.signed_at AS at,
               ROW_NUMBER() OVER (PARTITION BY cl.inventory_item_id ORDER BY c.signed_at DESC) AS n
        FROM count_lines cl JOIN counts c ON c.id = cl.count_id
        WHERE cl.organization_id = ${siteId} AND cl.inventory_item_id IN (${Prisma.join(itemIds)})
          AND cl.counted_qty IS NOT NULL AND cl.expected_qty IS NOT NULL
          AND c.status IN ('SUBMITTED', 'APPROVED') AND c.signed_at IS NOT NULL
      ) x WHERE n <= 3 ORDER BY item_id, n`);
    return rows.map((r) => ({ itemId: r.item_id, countReference: r.reference, difference: new Prisma.Decimal(r.difference), at: r.at }));
  },

  /** Lines flagged to the Director: not yet seen first, then the newest. */
  flagged: async (siteId: string, paging: { page: number; pageSize: number }, client: Client = prisma): Promise<{ rows: FlaggedRow[]; total: number }> => {
    const where: Prisma.CountLineWhereInput = { siteId, directorFlagged: true };
    const [rows, total] = await Promise.all([
      client.countLine.findMany({
        where,
        orderBy: [{ directorSeenAt: { sort: 'asc', nulls: 'first' } }, { count: { signedAt: 'desc' } }, { position: 'asc' }],
        skip: (paging.page - 1) * paging.pageSize,
        take: paging.pageSize,
        select: {
          id: true,
          countedQty: true,
          expectedQty: true,
          unitCost: true,
          cause: true,
          directorAlert: true,
          directorSeenAt: true,
          directorSeenBy: PERSON,
          inventoryItem: { select: { name: true, usageUnit: true } },
          count: { select: { id: true, reference: true, counter: PERSON } },
        },
      }),
      client.countLine.count({ where }),
    ]);
    return {
      total,
      rows: rows.flatMap((r) =>
        r.countedQty && r.expectedQty && r.unitCost
          ? [{ countId: r.count.id, countReference: r.count.reference, lineId: r.id, itemName: r.inventoryItem.name, unit: r.inventoryItem.usageUnit, countedQty: r.countedQty, expectedQty: r.expectedQty, unitCost: r.unitCost, cause: r.cause, countedBy: r.count.counter, alert: r.directorAlert, seenAt: r.directorSeenAt, seenBy: r.directorSeenBy }]
          : [],
      ),
    };
  },
};
