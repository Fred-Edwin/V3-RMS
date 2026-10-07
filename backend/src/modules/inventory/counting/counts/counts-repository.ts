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

/** The Counts screens' reads. Every query carries `siteId`; nothing here writes. */
export const countsRepository = {
  ...countRecordRepository,
  unsectionedCount: (siteId: string, client: Client = prisma): Promise<number> => countReadsRepository.unsectionedCount(siteId, client),

  /** The Counts table: filtered by status chip and a search over reference, section and counter, newest first, one page. */
  list: async (
    siteId: string,
    filter: { status: StatusFilter; search?: string },
    paging: { page: number; pageSize: number },
    client: Client = prisma,
  ): Promise<{ rows: CountListRow[]; total: number }> => {
    const where: Prisma.CountWhereInput = {
      siteId,
      ...(filter.status !== 'all' ? { status: STATUS_OF[filter.status] } : {}),
      ...(filter.search
        ? {
            OR: [
              { reference: { contains: filter.search, mode: 'insensitive' } },
              { counter: { name: { contains: filter.search, mode: 'insensitive' } } },
              { scopeSections: { some: { sectionName: { contains: filter.search, mode: 'insensitive' } } } },
              { lines: { some: { inventoryItem: { name: { contains: filter.search, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
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

  /** The numbers on the status chips (the search does not change them). */
  chipCounts: async (siteId: string, client: Client = prisma): Promise<{ all: number; waiting: number; inProgress: number; approved: number }> => {
    const grouped = await client.count.groupBy({ by: ['status'], where: { siteId }, _count: { _all: true } });
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
