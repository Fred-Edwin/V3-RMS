import { Prisma, type CountSectionKind, type DepartmentTag, type InventoryItemType, type UserRole } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { countReadsRepository } from '../_shared/count-reads-repository';
import { countSectionsRepository, type SectionItemRow, type SectionRow } from '../_shared/count-sections-repository';

type Client = typeof prisma | Prisma.TransactionClient;

export type { SectionItemRow, SectionRow };

export type MoveRow = {
  id: string;
  itemId: string;
  itemName: string;
  fromSectionId: string | null;
  fromSectionName: string | null;
  toSectionId: string;
  toSectionName: string;
  movedBy: { id: string; name: string; role: UserRole };
  movedAt: Date;
  undoneAt: Date | null;
};

const moveSelect = {
  id: true,
  inventoryItemId: true,
  fromSectionId: true,
  toSectionId: true,
  movedAt: true,
  undoneAt: true,
  inventoryItem: { select: { name: true } },
  fromSection: { select: { name: true } },
  toSection: { select: { name: true } },
  movedBy: { select: { id: true, name: true, role: true } },
} satisfies Prisma.CountItemMoveSelect;

const toMoveRow = (r: Prisma.CountItemMoveGetPayload<{ select: typeof moveSelect }>): MoveRow => ({
  id: r.id,
  itemId: r.inventoryItemId,
  itemName: r.inventoryItem.name,
  fromSectionId: r.fromSectionId,
  fromSectionName: r.fromSection?.name ?? null,
  toSectionId: r.toSectionId,
  toSectionName: r.toSection.name,
  movedBy: r.movedBy,
  movedAt: r.movedAt,
  undoneAt: r.undoneAt,
});

export type Placement = { itemId: string; sectionId: string; sectionName: string; position: number };
export type ItemFacts = { id: string; name: string; unit: string };

export type AddableFilters = { sectionId: string; q?: string; tab: 'unsectioned' | 'other'; categoryId?: string; type?: InventoryItemType; departmentTag?: DepartmentTag };

export type AddableRow = {
  itemId: string;
  name: string;
  categoryName: string | null;
  type: InventoryItemType;
  unit: string;
  hasSupplier: boolean;
  section: { id: string; name: string } | null;
};

/** Count setup's reads and writes. A `prisma.$transaction` is opened by the service; every function that writes takes its client. */
export const setupRepository = {
  listSections: (siteId: string, client: Client = prisma): Promise<SectionRow[]> => countSectionsRepository.listSections(siteId, client),
  listPlacedItems: (siteId: string, sectionIds: string[] | null, client: Client = prisma): Promise<SectionItemRow[]> => countSectionsRepository.listItems(siteId, sectionIds, client),

  /** Live items in no section, by name. */
  unsectionedItems: (siteId: string, client: Client = prisma): Promise<ItemFacts[]> =>
    client.inventoryItem
      .findMany({ where: { siteId, deletedAt: null, countSectionItems: { none: {} } }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id: true, name: true, usageUnit: true } })
      .then((rows) => rows.map((r) => ({ id: r.id, name: r.name, unit: r.usageUnit }))),

  /** One lock per site, held to the end of the caller's transaction, so two layout edits cannot interleave. */
  lockLayout: async (tx: Prisma.TransactionClient, siteId: string): Promise<void> => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`count-setup:${siteId}`}))`);
  },

  lastVisit: async (siteId: string, userId: string, client: Client = prisma): Promise<Date | null> =>
    (await client.countSetupVisit.findUnique({ where: { siteId_userId: { siteId, userId } }, select: { lastVisitAt: true } }))?.lastVisitAt ?? null,

  stampVisit: async (siteId: string, userId: string, at: Date, client: Client = prisma): Promise<void> => {
    await client.countSetupVisit.upsert({ where: { siteId_userId: { siteId, userId } }, create: { siteId, userId, lastVisitAt: at }, update: { lastVisitAt: at } });
  },

  /** Moves other people made after `since` that are still standing, newest first. */
  movesSince: async (siteId: string, since: Date, exceptUserId: string, client: Client = prisma): Promise<MoveRow[]> =>
    (
      await client.countItemMove.findMany({
        where: { siteId, movedAt: { gt: since }, undoneAt: null, movedById: { not: exceptUserId } },
        orderBy: { movedAt: 'desc' },
        select: moveSelect,
      })
    ).map(toMoveRow),

  /** The latest move of each item (undone or not), by item id. */
  latestMoveByItem: async (siteId: string, itemIds: string[], client: Client = prisma): Promise<Map<string, MoveRow>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await client.countItemMove.findMany({
      where: { siteId, inventoryItemId: { in: itemIds } },
      orderBy: { movedAt: 'desc' },
      select: moveSelect,
    });
    const latest = new Map<string, MoveRow>();
    for (const row of rows) if (!latest.has(row.inventoryItemId)) latest.set(row.inventoryItemId, toMoveRow(row));
    return latest;
  },

  findMove: async (siteId: string, id: string, client: Client = prisma): Promise<MoveRow | null> => {
    const row = await client.countItemMove.findFirst({ where: { id, siteId }, select: moveSelect });
    return row ? toMoveRow(row) : null;
  },

  findSection: (siteId: string, id: string, client: Client = prisma): Promise<{ id: string; name: string; kind: CountSectionKind } | null> =>
    client.countSection.findFirst({ where: { id, siteId }, select: { id: true, name: true, kind: true } }),

  /** A section already called this, ignoring case and surrounding spaces. */
  nameTaken: async (siteId: string, name: string, client: Client = prisma): Promise<boolean> =>
    (await client.countSection.count({ where: { siteId, name: { equals: name.trim(), mode: 'insensitive' } } })) > 0,

  createSection: async (tx: Prisma.TransactionClient, siteId: string, name: string): Promise<{ id: string }> => {
    const last = await tx.countSection.aggregate({ where: { siteId }, _max: { position: true } });
    return tx.countSection.create({ data: { siteId, name: name.trim(), kind: 'MANUAL', position: (last._max.position ?? -1) + 1 }, select: { id: true } });
  },

  /** Live items by id, within this site. Retired or foreign ids are simply absent. */
  liveItems: async (siteId: string, ids: string[], client: Client = prisma): Promise<ItemFacts[]> =>
    (await client.inventoryItem.findMany({ where: { siteId, deletedAt: null, id: { in: ids } }, select: { id: true, name: true, usageUnit: true } })).map((r) => ({ id: r.id, name: r.name, unit: r.usageUnit })),

  placementsOf: async (siteId: string, itemIds: string[], client: Client = prisma): Promise<Map<string, Placement>> => {
    if (itemIds.length === 0) return new Map();
    const rows = await client.countSectionItem.findMany({
      where: { siteId, inventoryItemId: { in: itemIds } },
      select: { inventoryItemId: true, position: true, section: { select: { id: true, name: true } } },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, { itemId: r.inventoryItemId, sectionId: r.section.id, sectionName: r.section.name, position: r.position }]));
  },

  nextItemPosition: async (client: Client, sectionId: string): Promise<number> => {
    const last = await client.countSectionItem.aggregate({ where: { sectionId }, _max: { position: true } });
    return (last._max.position ?? -1) + 1;
  },

  insertPlacements: async (tx: Prisma.TransactionClient, siteId: string, rows: { itemId: string; sectionId: string; position: number; addedById: string | null }[]): Promise<void> => {
    if (rows.length === 0) return;
    await tx.countSectionItem.createMany({
      data: rows.map((r) => ({ siteId, sectionId: r.sectionId, inventoryItemId: r.itemId, position: r.position, addedById: r.addedById })),
    });
  },

  deletePlacement: async (tx: Prisma.TransactionClient, siteId: string, itemId: string): Promise<void> => {
    await tx.countSectionItem.deleteMany({ where: { siteId, inventoryItemId: itemId } });
  },

  /** Sets the section and position of many placed items in one statement. */
  rewritePlacements: async (tx: Prisma.TransactionClient, siteId: string, rows: { itemId: string; sectionId: string; position: number }[]): Promise<void> => {
    if (rows.length === 0) return;
    await tx.$executeRaw(Prisma.sql`
      UPDATE count_section_items t SET section_id = v.section_id, position = v.pos
      FROM (SELECT * FROM unnest(${rows.map((r) => r.itemId)}::text[], ${rows.map((r) => r.sectionId)}::text[], ${rows.map((r) => r.position)}::int[]) AS u(item_id, section_id, pos)) v
      WHERE t.organization_id = ${siteId} AND t.inventory_item_id = v.item_id`);
  },

  rewriteSectionPositions: async (tx: Prisma.TransactionClient, siteId: string, rows: { id: string; position: number }[]): Promise<void> => {
    if (rows.length === 0) return;
    await tx.$executeRaw(Prisma.sql`
      UPDATE count_sections t SET position = v.pos
      FROM (SELECT * FROM unnest(${rows.map((r) => r.id)}::text[], ${rows.map((r) => r.position)}::int[]) AS u(id, pos)) v
      WHERE t.organization_id = ${siteId} AND t.id = v.id`);
  },

  createMoves: async (tx: Prisma.TransactionClient, siteId: string, rows: { itemId: string; fromSectionId: string | null; toSectionId: string; movedById: string; movedAt: Date }[]): Promise<void> => {
    if (rows.length === 0) return;
    await tx.countItemMove.createMany({
      data: rows.map((r) => ({ siteId, inventoryItemId: r.itemId, fromSectionId: r.fromSectionId, toSectionId: r.toSectionId, movedById: r.movedById, movedAt: r.movedAt })),
    });
  },

  /** One move, and the row it made (the move view of C21 needs its id). */
  createMove: async (
    tx: Prisma.TransactionClient,
    siteId: string,
    row: { itemId: string; fromSectionId: string | null; toSectionId: string; movedById: string; movedAt: Date },
  ): Promise<MoveRow> =>
    toMoveRow(
      await tx.countItemMove.create({
        data: { siteId, inventoryItemId: row.itemId, fromSectionId: row.fromSectionId, toSectionId: row.toSectionId, movedById: row.movedById, movedAt: row.movedAt },
        select: moveSelect,
      }),
    ),

  markUndone: async (tx: Prisma.TransactionClient, siteId: string, id: string, userId: string, at: Date): Promise<boolean> =>
    (await tx.countItemMove.updateMany({ where: { id, siteId, undoneAt: null }, data: { undoneAt: at, undoneById: userId } })).count === 1,

  lastCountedByItem: (siteId: string, itemIds: string[], client: Client = prisma) => countReadsRepository.lastCountedByItem(siteId, itemIds, client),

  /** C19: live items that could be added to a section, searched as you type. Items already in the section are never listed. */
  listAddable: async (
    siteId: string,
    filters: AddableFilters,
    paging: { page: number; pageSize: number },
    client: Client = prisma,
  ): Promise<{ rows: AddableRow[]; total: number; chips: { unsectioned: number; otherSections: number } }> => {
    const common: Prisma.InventoryItemWhereInput = {
      siteId,
      deletedAt: null,
      ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.departmentTag ? { departmentTags: { has: filters.departmentTag } } : {}),
    };
    const unsectioned: Prisma.InventoryItemWhereInput = { ...common, countSectionItems: { none: {} } };
    const other: Prisma.InventoryItemWhereInput = { ...common, countSectionItems: { some: { sectionId: { not: filters.sectionId } } } };
    // A search looks at every section at once ("3 matches for “oat” · all sections"); without one the tab picks the group.
    const listed: Prisma.InventoryItemWhereInput = filters.q ? { OR: [unsectioned, other] } : filters.tab === 'unsectioned' ? unsectioned : other;

    const [rows, total, chipUnsectioned, chipOther] = await Promise.all([
      client.inventoryItem.findMany({
        where: listed,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (paging.page - 1) * paging.pageSize,
        take: paging.pageSize,
        select: {
          id: true,
          name: true,
          type: true,
          usageUnit: true,
          preferredSupplierId: true,
          category: { select: { name: true } },
          countSectionItems: { select: { section: { select: { id: true, name: true } } } },
        },
      }),
      client.inventoryItem.count({ where: listed }),
      client.inventoryItem.count({ where: unsectioned }),
      client.inventoryItem.count({ where: other }),
    ]);

    return {
      rows: rows.map((r) => ({
        itemId: r.id,
        name: r.name,
        categoryName: r.category?.name ?? null,
        type: r.type,
        unit: r.usageUnit,
        hasSupplier: r.preferredSupplierId !== null,
        section: r.countSectionItems[0]?.section ?? null,
      })),
      total,
      chips: { unsectioned: chipUnsectioned, otherSections: chipOther },
    };
  },
};
