import { Prisma, type CountStatus } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Client = typeof prisma | Prisma.TransactionClient;

export type TodaysCountRow = {
  id: string;
  reference: string;
  status: CountStatus;
  selfSigned: boolean;
  startedAt: Date;
  signedAt: Date | null;
  counterName: string;
  scopeNames: string[];
  firstItemNames: string[];
};

export type SectionLastCounted = { id: string; name: string; itemCount: number; lastCountedAt: Date | null };
export type ItemLastCounted = { id: string; name: string; sectionName: string; sectionId: string; lastCountedAt: Date | null };

/** The reads other sub-modules (Stock Overview, All items) build on, through `count-reads.ts` only. Every query carries `siteId`. */
export const countReadsRepository = {
  /** Counts started or signed in a window (a Nairobi day), newest first. */
  countsInWindow: async (siteId: string, from: Date, to: Date, client: Client = prisma): Promise<TodaysCountRow[]> => {
    const rows = await client.count.findMany({
      where: { siteId, OR: [{ startedAt: { gte: from, lt: to } }, { signedAt: { gte: from, lt: to } }] },
      select: {
        id: true,
        reference: true,
        status: true,
        selfSigned: true,
        startedAt: true,
        signedAt: true,
        counter: { select: { name: true } },
        scopeSections: { orderBy: { sectionName: 'asc' }, select: { sectionName: true } },
        lines: { orderBy: { position: 'asc' }, take: 3, select: { inventoryItem: { select: { name: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      selfSigned: r.selfSigned,
      startedAt: r.startedAt,
      signedAt: r.signedAt,
      counterName: r.counter.name,
      scopeNames: r.scopeSections.map((s) => s.sectionName),
      firstItemNames: r.lines.map((l) => l.inventoryItem.name),
    }));
  },

  /** Every section that holds at least one live item, with the last time a signed count had it in scope. */
  sectionsLastCounted: async (siteId: string, client: Client = prisma): Promise<SectionLastCounted[]> => {
    const rows = await client.$queryRaw<{ id: string; name: string; item_count: number; last_at: Date | null }[]>(Prisma.sql`
      SELECT s.id, s.name, COUNT(i.id)::int AS item_count,
        (SELECT MAX(c.signed_at)
           FROM count_scope_sections cs
           JOIN counts c ON c.id = cs.count_id
          WHERE cs.section_id = s.id AND c.organization_id = ${siteId}
            AND c.status IN ('SUBMITTED', 'APPROVED') AND c.signed_at IS NOT NULL) AS last_at
      FROM count_sections s
      JOIN count_section_items i ON i.section_id = s.id
      JOIN inventory_items it ON it.id = i.inventory_item_id AND it.deleted_at IS NULL
      WHERE s.organization_id = ${siteId}
      GROUP BY s.id, s.name`);
    return rows.map((r) => ({ id: r.id, name: r.name, itemCount: r.item_count, lastCountedAt: r.last_at }));
  },

  /** Every live item that sits in a section, with the last time a signed count gave it a number. */
  itemsLastCounted: async (siteId: string, client: Client = prisma): Promise<ItemLastCounted[]> => {
    const rows = await client.$queryRaw<{ id: string; name: string; section_id: string; section_name: string; last_at: Date | null }[]>(Prisma.sql`
      SELECT it.id, it.name, s.id AS section_id, s.name AS section_name,
        (SELECT MAX(c.signed_at)
           FROM count_lines cl
           JOIN counts c ON c.id = cl.count_id
          WHERE cl.inventory_item_id = it.id AND cl.organization_id = ${siteId}
            AND cl.counted_qty IS NOT NULL AND c.status IN ('SUBMITTED', 'APPROVED')) AS last_at
      FROM count_section_items i
      JOIN count_sections s ON s.id = i.section_id
      JOIN inventory_items it ON it.id = i.inventory_item_id AND it.deleted_at IS NULL
      WHERE i.organization_id = ${siteId}`);
    return rows.map((r) => ({ id: r.id, name: r.name, sectionName: r.section_name, sectionId: r.section_id, lastCountedAt: r.last_at }));
  },

  /** The latest SUBMITTED or APPROVED count that gave each item a number. Items never counted are absent. */
  lastCountedByItem: async (siteId: string, itemIds: string[], client: Client = prisma): Promise<{ itemId: string; at: Date; reference: string }[]> => {
    if (itemIds.length === 0) return [];
    const rows = await client.$queryRaw<{ item_id: string; at: Date; reference: string }[]>(Prisma.sql`
      SELECT DISTINCT ON (cl.inventory_item_id) cl.inventory_item_id AS item_id, c.signed_at AS at, c.reference
      FROM count_lines cl
      JOIN counts c ON c.id = cl.count_id
      WHERE cl.organization_id = ${siteId}
        AND cl.inventory_item_id IN (${Prisma.join(itemIds)})
        AND cl.counted_qty IS NOT NULL
        AND c.status IN ('SUBMITTED', 'APPROVED') AND c.signed_at IS NOT NULL
      ORDER BY cl.inventory_item_id, c.signed_at DESC`);
    return rows.map((r) => ({ itemId: r.item_id, at: r.at, reference: r.reference }));
  },

  sectionNamesByItem: async (siteId: string, itemIds: string[], client: Client = prisma): Promise<{ itemId: string; name: string }[]> => {
    if (itemIds.length === 0) return [];
    const rows = await client.countSectionItem.findMany({
      where: { siteId, inventoryItemId: { in: itemIds } },
      select: { inventoryItemId: true, section: { select: { name: true } } },
    });
    return rows.map((r) => ({ itemId: r.inventoryItemId, name: r.section.name }));
  },

  /**
   * Live items in no section that are not about to be adopted: an item whose preferred supplier already has a SUPPLIER section is
   * placed there by the next `adoptNewItems`, so it is not "Not in any section" for anyone's purposes.
   */
  unsectionedCount: (siteId: string, client: Client = prisma): Promise<number> =>
    client.inventoryItem.count({
      where: {
        siteId,
        deletedAt: null,
        countSectionItems: { none: {} },
        OR: [{ preferredSupplierId: null }, { preferredSupplier: { countSections: { none: { kind: 'SUPPLIER' } } } }],
      },
    }),
};
