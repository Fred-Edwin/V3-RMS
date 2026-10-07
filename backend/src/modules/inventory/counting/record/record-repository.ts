import { Prisma, type CountCause, type CountDecisionKind, type CountLineResult, type CountRecheck } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { countReadsRepository } from '../_shared/count-reads-repository';
import { countRecordRepository } from '../_shared/count-record-repository';
import { countSectionsRepository, type SectionItemRow, type SectionRow } from '../_shared/count-sections-repository';
import { dayAsDate } from '../_shared/count-time';

type Client = typeof prisma | Prisma.TransactionClient;

export type { SectionItemRow, SectionRow };

/** An open line that keeps an item busy, and whose count it is. */
export type BusyLine = { itemId: string; countId: string; reference: string; counterName: string };

/** A section's last signed count (scope-based) and the person who counted it. */
export type SectionLastCount = { sectionId: string; at: Date; counterName: string };

/** The facts of one item a count line is made from. */
export type ScopeItem = { id: string; name: string; unit: string; sectionId: string | null; sectionName: string | null };

export type LineFreeze = {
  expectedQty: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  result: CountLineResult;
  shortStreak: number;
  decision?: CountDecisionKind;
  cause?: CountCause | null;
  causeNote?: string | null;
  decidedById?: string | null;
  decidedAt?: Date | null;
  directorFlagged?: boolean;
  directorAlert?: boolean;
};

/** Taking a count: starting, saving numbers, rechecking, signing. A `prisma.$transaction` is opened by the service. */
export const recordRepository = {
  ...countRecordRepository,
  listSections: (siteId: string, client: Client = prisma): Promise<SectionRow[]> => countSectionsRepository.listSections(siteId, client),
  listSectionItems: (siteId: string, sectionIds: string[] | null, client: Client = prisma): Promise<SectionItemRow[]> => countSectionsRepository.listItems(siteId, sectionIds, client),

  // --- start options (C8) ---------------------------------------------------

  /** Live items in no section that are not about to be adopted ("Unsectioned 3"). */
  unsectionedCount: (siteId: string, client: Client = prisma): Promise<number> => countReadsRepository.unsectionedCount(siteId, client),

  /** Each section's last signed count (the latest count that had the section in its scope) and who counted it. */
  sectionLastCounts: async (siteId: string, client: Client = prisma): Promise<SectionLastCount[]> => {
    const rows = await client.$queryRaw<{ section_id: string; at: Date; counter_name: string }[]>(Prisma.sql`
      SELECT DISTINCT ON (cs.section_id) cs.section_id, c.signed_at AS at, u.name AS counter_name
      FROM count_scope_sections cs
      JOIN counts c ON c.id = cs.count_id
      JOIN users u ON u.id = c.counter_id
      WHERE c.organization_id = ${siteId} AND cs.section_id IS NOT NULL
        AND c.status IN ('SUBMITTED', 'APPROVED') AND c.signed_at IS NOT NULL
      ORDER BY cs.section_id, c.signed_at DESC`);
    return rows.map((r) => ({ sectionId: r.section_id, at: r.at, counterName: r.counter_name }));
  },

  /** For each section: an open count that holds one of its live items (the section is busy), if any. */
  busySections: async (siteId: string, client: Client = prisma): Promise<{ sectionId: string; countId: string; reference: string; counterName: string }[]> => {
    const rows = await client.$queryRaw<{ section_id: string; count_id: string; reference: string; counter_name: string }[]>(Prisma.sql`
      SELECT DISTINCT ON (s.id) s.id AS section_id, c.id AS count_id, c.reference, u.name AS counter_name
      FROM count_sections s
      JOIN count_section_items i ON i.section_id = s.id
      JOIN count_lines cl ON cl.inventory_item_id = i.inventory_item_id AND cl.is_open
      JOIN counts c ON c.id = cl.count_id AND c.status = 'OPEN'
      JOIN users u ON u.id = c.counter_id
      WHERE s.organization_id = ${siteId}
      ORDER BY s.id, c.started_at`);
    return rows.map((r) => ({ sectionId: r.section_id, countId: r.count_id, reference: r.reference, counterName: r.counter_name }));
  },

  findDayOrder: async (siteId: string, userId: string, day: string, client: Client = prisma): Promise<string[] | null> =>
    (await client.countDayOrder.findUnique({ where: { siteId_userId_day: { siteId, userId, day: dayAsDate(day) } }, select: { sectionIds: true } }))?.sectionIds ?? null,

  saveDayOrder: async (siteId: string, userId: string, day: string, sectionIds: string[], client: Client = prisma): Promise<void> => {
    await client.countDayOrder.upsert({
      where: { siteId_userId_day: { siteId, userId, day: dayAsDate(day) } },
      create: { siteId, userId, day: dayAsDate(day), sectionIds },
      update: { sectionIds },
    });
  },

  sectionsByIds: async (siteId: string, ids: string[], client: Client = prisma): Promise<{ id: string; name: string }[]> =>
    client.countSection.findMany({ where: { siteId, id: { in: ids } }, select: { id: true, name: true } }),

  // --- starting (C9) --------------------------------------------------------

  /** The live items by id, each with the section it sits in now (frozen onto the line). */
  scopeItemsById: async (siteId: string, itemIds: string[], client: Client = prisma): Promise<ScopeItem[]> => {
    const rows = await client.inventoryItem.findMany({
      where: { siteId, deletedAt: null, id: { in: itemIds } },
      select: { id: true, name: true, usageUnit: true, countSectionItems: { select: { section: { select: { id: true, name: true } } } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, unit: r.usageUnit, sectionId: r.countSectionItems[0]?.section.id ?? null, sectionName: r.countSectionItems[0]?.section.name ?? null }));
  },

  /** Takes a row lock on the picked sections (in id order, so two starters cannot deadlock) until the transaction ends. */
  lockSections: async (tx: Prisma.TransactionClient, siteId: string, sectionIds: string[]): Promise<void> => {
    if (sectionIds.length === 0) return;
    await tx.$queryRaw(Prisma.sql`SELECT id FROM count_sections WHERE organization_id = ${siteId} AND id IN (${Prisma.join([...sectionIds].sort())}) ORDER BY id FOR UPDATE`);
  },

  /** Open lines on any of these items, with whose count holds them. */
  busyLines: async (siteId: string, itemIds: string[], client: Client = prisma): Promise<BusyLine[]> => {
    if (itemIds.length === 0) return [];
    const rows = await client.countLine.findMany({
      where: { siteId, isOpen: true, inventoryItemId: { in: itemIds } },
      select: { inventoryItemId: true, count: { select: { id: true, reference: true, counter: { select: { name: true } } } } },
    });
    return rows.map((r) => ({ itemId: r.inventoryItemId, countId: r.count.id, reference: r.count.reference, counterName: r.count.counter.name }));
  },

  createCount: async (
    tx: Prisma.TransactionClient,
    data: {
      siteId: string;
      locationId: string;
      reference: string;
      counterId: string;
      startedAt: Date;
      recountOfLineId: string | null;
      idempotencyKey: string;
      scopeSections: { sectionId: string; sectionName: string }[];
      lines: { itemId: string; sectionId: string | null; sectionName: string | null }[];
    },
  ): Promise<{ id: string }> => {
    const count = await tx.count.create({
      data: {
        siteId: data.siteId,
        locationId: data.locationId,
        reference: data.reference,
        counterId: data.counterId,
        startedAt: data.startedAt,
        recountOfLineId: data.recountOfLineId,
        idempotencyKey: data.idempotencyKey,
        scopeSections: { create: data.scopeSections.map((s) => ({ sectionId: s.sectionId, sectionName: s.sectionName })) },
      },
      select: { id: true },
    });
    await tx.countLine.createMany({
      data: data.lines.map((l, position) => ({ siteId: data.siteId, countId: count.id, inventoryItemId: l.itemId, sectionId: l.sectionId, sectionName: l.sectionName, position })),
    });
    return count;
  },

  // --- the sign transaction -------------------------------------------------

  /** Locks the count row until the transaction ends, so a double tap or two devices cannot both sign it. */
  lockCount: async (tx: Prisma.TransactionClient, siteId: string, id: string): Promise<void> => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM counts WHERE organization_id = ${siteId} AND id = ${id} FOR UPDATE`);
  },

  /** One query for the last differences of many items (newest first, this count excluded), for the repeat-shortfall streak. */
  recentDifferencesByItem: async (
    tx: Prisma.TransactionClient,
    siteId: string,
    itemIds: string[],
    before: Date,
    excludeCountId: string,
    perItem: number,
  ): Promise<Map<string, Prisma.Decimal[]>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await tx.$queryRaw<{ item_id: string; difference: Prisma.Decimal }[]>(Prisma.sql`
      SELECT item_id, difference FROM (
        SELECT cl.inventory_item_id AS item_id, (cl.counted_qty - cl.expected_qty) AS difference,
               ROW_NUMBER() OVER (PARTITION BY cl.inventory_item_id ORDER BY c.signed_at DESC) AS n
        FROM count_lines cl
        JOIN counts c ON c.id = cl.count_id
        WHERE cl.organization_id = ${siteId}
          AND cl.inventory_item_id IN (${Prisma.join(itemIds)})
          AND cl.counted_qty IS NOT NULL AND cl.expected_qty IS NOT NULL
          AND c.status IN ('SUBMITTED', 'APPROVED') AND c.signed_at <= ${before} AND c.id <> ${excludeCountId}
      ) ranked
      WHERE n <= ${perItem}
      ORDER BY item_id, n`);
    const byItem = new Map<string, Prisma.Decimal[]>();
    for (const row of rows) byItem.set(row.item_id, [...(byItem.get(row.item_id) ?? []), new Prisma.Decimal(row.difference)]);
    return byItem;
  },

  freezeLine: async (tx: Prisma.TransactionClient, lineId: string, data: LineFreeze): Promise<void> => {
    await tx.countLine.update({
      where: { id: lineId },
      data: {
        isOpen: false,
        expectedQty: data.expectedQty,
        unitCost: data.unitCost,
        result: data.result,
        shortStreak: data.shortStreak,
        ...(data.decision ? { decision: data.decision } : {}),
        ...(data.cause !== undefined ? { cause: data.cause } : {}),
        ...(data.causeNote !== undefined ? { causeNote: data.causeNote } : {}),
        ...(data.decidedById !== undefined ? { decidedById: data.decidedById } : {}),
        ...(data.decidedAt !== undefined ? { decidedAt: data.decidedAt } : {}),
        ...(data.directorFlagged !== undefined ? { directorFlagged: data.directorFlagged } : {}),
        ...(data.directorAlert !== undefined ? { directorAlert: data.directorAlert } : {}),
      },
    });
  },

  /** The counter's sign: status, times and the settings in force, frozen on the count. `updatedAt` stays at the last time a number was saved. */
  markSigned: async (
    tx: Prisma.TransactionClient,
    countId: string,
    data: {
      status: 'SUBMITTED' | 'APPROVED';
      signedAt: Date;
      selfSigned: boolean;
      approverId: string | null;
      approvedAt: Date | null;
      idempotencyKey: string;
      rangeKes: number;
      rangePercent: Prisma.Decimal;
      directorAlertKes: number;
      flagRepeat: boolean;
      lastSavedAt: Date;
    },
  ): Promise<void> => {
    await tx.count.update({
      where: { id: countId },
      data: {
        status: data.status,
        signedAt: data.signedAt,
        expectedAsOf: data.signedAt,
        selfSigned: data.selfSigned,
        approverId: data.approverId,
        approvedAt: data.approvedAt,
        idempotencyKey: data.idempotencyKey,
        rangeKes: data.rangeKes,
        rangePercent: data.rangePercent,
        directorAlertKes: data.directorAlertKes,
        flagRepeat: data.flagRepeat,
        updatedAt: data.lastSavedAt,
      },
    });
  },

  // --- saving numbers (C10), the section-end check (C11) --------------------

  /** One line's new number and flags. Typing a number clears Skip; Skip clears the number (the service decides which). */
  saveLine: async (
    tx: Prisma.TransactionClient,
    lineId: string,
    data: { countedQty: Prisma.Decimal | null; skipped: boolean; recheck?: CountRecheck; firstCountedQty?: Prisma.Decimal | null },
  ): Promise<void> => {
    await tx.countLine.update({
      where: { id: lineId },
      data: {
        countedQty: data.countedQty,
        skipped: data.skipped,
        ...(data.recheck ? { recheck: data.recheck } : {}),
        ...(data.firstCountedQty !== undefined ? { firstCountedQty: data.firstCountedQty } : {}),
      },
    });
  },

  /** Stamps the last time a number was saved ("Saved 07:19"). */
  touchCount: async (tx: Prisma.TransactionClient, countId: string, at: Date): Promise<void> => {
    await tx.count.update({ where: { id: countId }, data: { updatedAt: at } });
  },

  markRecheckOffered: async (siteId: string, lineIds: string[], client: Client = prisma): Promise<void> => {
    if (lineIds.length === 0) return;
    await client.countLine.updateMany({ where: { siteId, id: { in: lineIds }, isOpen: true }, data: { recheckOffered: true } });
  },
};
