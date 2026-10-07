import { Prisma, type CountSectionKind } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Client = typeof prisma | Prisma.TransactionClient;

export type SectionRow = {
  id: string;
  name: string;
  kind: CountSectionKind;
  supplierId: string | null;
  supplierName: string | null;
  position: number;
  /** Live (not retired) items only. */
  itemCount: number;
};

export type SectionItemRow = { itemId: string; name: string; unit: string; position: number; sectionId: string; sectionName: string };

/**
 * The count sections and their items, as the Manager's shelf order has them (contract §2.2). Shared by Count setup (which edits them)
 * and the count flow (which reads them to start a count), so there is one place that knows what "a section's items" means: the
 * LIVE items placed in it, in `position` order. Every query carries `siteId`.
 */
export const countSectionsRepository = {
  /** Every section in shelf order, with how many live items sit in it. */
  listSections: async (siteId: string, client: Client = prisma): Promise<SectionRow[]> => {
    const rows = await client.countSection.findMany({
      where: { siteId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        kind: true,
        position: true,
        supplier: { select: { id: true, name: true } },
        items: { where: { inventoryItem: { deletedAt: null } }, select: { id: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      supplierId: r.supplier?.id ?? null,
      supplierName: r.supplier?.name ?? null,
      position: r.position,
      itemCount: r.items.length,
    }));
  },

  /** The live items of some sections (all of them when none are named), section by section in shelf order, item by item in `position`. */
  listItems: async (siteId: string, sectionIds: string[] | null, client: Client = prisma): Promise<SectionItemRow[]> => {
    const rows = await client.countSectionItem.findMany({
      where: { siteId, ...(sectionIds ? { sectionId: { in: sectionIds } } : {}), inventoryItem: { deletedAt: null } },
      orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }, { inventoryItem: { name: 'asc' } }],
      select: { position: true, section: { select: { id: true, name: true } }, inventoryItem: { select: { id: true, name: true, usageUnit: true } } },
    });
    return rows.map((r) => ({ itemId: r.inventoryItem.id, name: r.inventoryItem.name, unit: r.inventoryItem.usageUnit, position: r.position, sectionId: r.section.id, sectionName: r.section.name }));
  },

  /**
   * Places each new item whose preferred supplier already has a SUPPLIER section at the END of that section (contract §2.7). One
   * statement, so two callers at once cannot place an item twice (the unique key decides). Returns how many were placed.
   */
  adoptNewItems: (siteId: string, client: Client = prisma): Promise<number> =>
    client.$executeRaw(Prisma.sql`
      INSERT INTO count_section_items (id, organization_id, section_id, inventory_item_id, position, added_at)
      SELECT gen_random_uuid()::text, i.organization_id, s.id, i.id,
             COALESCE((SELECT MAX(x.position) + 1 FROM count_section_items x WHERE x.section_id = s.id), 0)
               + (ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY i.name, i.id) - 1),
             now()
      FROM inventory_items i
      JOIN count_sections s ON s.organization_id = i.organization_id AND s.kind = 'SUPPLIER' AND s.supplier_id = i.preferred_supplier_id
      WHERE i.organization_id = ${siteId}
        AND i.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM count_section_items c WHERE c.organization_id = i.organization_id AND c.inventory_item_id = i.id)
      ON CONFLICT (organization_id, inventory_item_id) DO NOTHING`),
};
