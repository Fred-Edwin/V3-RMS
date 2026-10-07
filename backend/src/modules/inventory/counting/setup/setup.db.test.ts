/**
 * Count setup against the REAL database (opt-in, `RUN_DB_TESTS=1`): adopting new supplier items, moving and undoing, the layout
 * rewrite, the add-items search, the "at most one section per item" key, and what the migration seeded. Every write happens inside
 * a transaction that is rolled back, so the database is left as found.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { countSectionsRepository } from '../_shared/count-sections-repository';
import { setupRepository } from './setup-repository';
import { layoutVersion } from './setup-version';

const enabled = process.env['RUN_DB_TESTS'] === '1';

class Rollback extends Error {}

const inRolledBackTx = async (work: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> => {
  await expect(
    prisma.$transaction(async (tx) => {
      await work(tx);
      throw new Rollback('roll back');
    }),
  ).rejects.toBeInstanceOf(Rollback);
};

describe.skipIf(!enabled)('count setup against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const hub = async () => (await prisma.site.findFirstOrThrow({ where: { isHub: true }, select: { id: true } })).id;
  const user = async () => (await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER' }, select: { id: true } })).id;

  let counter = 0;
  const newItem = (tx: Prisma.TransactionClient, siteId: string, over: Partial<Prisma.InventoryItemUncheckedCreateInput> = {}) =>
    tx.inventoryItem.create({
      data: { siteId, name: `Setup test item ${Date.now()}-${(counter += 1)}`, type: 'STOCKED', buyUnit: 'bag', usageUnit: 'kg', ...over },
      select: { id: true, name: true },
    });

  it('the migration seeded the first sections: supplier sections, "Others", an empty "Packaging", and every live item placed once', async () => {
    const siteId = await hub();
    const sections = await setupRepository.listSections(siteId);
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(sections.map((s) => s.position)).toEqual([...sections.map((s) => s.position)].sort((a, b) => a - b));
    const others = sections.find((s) => s.name === 'Others');
    expect(others).toMatchObject({ kind: 'MANUAL', supplierId: null });
    expect(sections.find((s) => s.name === 'Packaging')?.kind).toBe('MANUAL');
    expect(sections.filter((s) => s.kind === 'SUPPLIER').every((s) => s.supplierId !== null && s.supplierName !== null)).toBe(true);

    const placed = await setupRepository.listPlacedItems(siteId, null);
    expect(new Set(placed.map((p) => p.itemId)).size).toBe(placed.length); // an item is in at most ONE section
    const live = await prisma.inventoryItem.count({ where: { siteId, deletedAt: null } });
    const unsectioned = await setupRepository.unsectionedItems(siteId);
    expect(placed.length + unsectioned.length).toBe(live);
  });

  it('adoptNewItems places a new item of a supplier that has a section at the END of that section, once', async () => {
    const siteId = await hub();
    const section = await prisma.countSection.findFirstOrThrow({ where: { siteId, kind: 'SUPPLIER', items: { some: {} } }, select: { id: true, supplierId: true } });
    await inRolledBackTx(async (tx) => {
      const last = await tx.countSectionItem.aggregate({ where: { sectionId: section.id }, _max: { position: true } });
      const a = await newItem(tx, siteId, { preferredSupplierId: section.supplierId });
      const b = await newItem(tx, siteId, { preferredSupplierId: section.supplierId });
      const orphan = await newItem(tx, siteId); // no supplier: left alone
      expect(await countSectionsRepository.adoptNewItems(siteId, tx)).toBeGreaterThanOrEqual(2);
      const placed = await tx.countSectionItem.findMany({ where: { sectionId: section.id, inventoryItemId: { in: [a.id, b.id] } }, orderBy: { position: 'asc' } });
      expect(placed).toHaveLength(2);
      expect(placed[0]!.position).toBeGreaterThan(last._max.position ?? -1);
      expect(placed[1]!.position).toBe(placed[0]!.position + 1);
      expect(await tx.countSectionItem.count({ where: { inventoryItemId: orphan.id } })).toBe(0);
      expect(await countSectionsRepository.adoptNewItems(siteId, tx)).toBe(0); // idempotent
    });
  });

  it('an item cannot sit in two sections (the unique key), and a section name is unique per site', async () => {
    const siteId = await hub();
    const [s1, s2] = await prisma.countSection.findMany({ where: { siteId }, take: 2, orderBy: { position: 'asc' } });
    await expect(
      prisma.$transaction(async (tx) => {
        const item = await newItem(tx, siteId);
        await tx.countSectionItem.create({ data: { siteId, sectionId: s1!.id, inventoryItemId: item.id, position: 0 } });
        await tx.countSectionItem.create({ data: { siteId, sectionId: s2!.id, inventoryItemId: item.id, position: 0 } });
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(prisma.$transaction((tx) => tx.countSection.create({ data: { siteId, name: s1!.name, kind: 'MANUAL', position: 99 } }))).rejects.toMatchObject({ code: 'P2002' });
  });

  it('move, then undo: the item returns to the end of its old section, the log shows the undo, and moves read back by item and by time', async () => {
    const siteId = await hub();
    const userId = await user();
    const [from, to] = await prisma.countSection.findMany({ where: { siteId, items: { some: {} } }, take: 2, orderBy: { position: 'asc' } });
    const item = await prisma.countSectionItem.findFirstOrThrow({ where: { sectionId: from!.id, inventoryItem: { deletedAt: null } } });
    await inRolledBackTx(async (tx) => {
      const at = new Date();
      const position = await setupRepository.nextItemPosition(tx, to!.id);
      await setupRepository.rewritePlacements(tx, siteId, [{ itemId: item.inventoryItemId, sectionId: to!.id, position }]);
      const made = await setupRepository.createMove(tx, siteId, { itemId: item.inventoryItemId, fromSectionId: from!.id, toSectionId: to!.id, movedById: userId, movedAt: at });
      expect(made).toMatchObject({ fromSectionName: from!.name, toSectionName: to!.name, undoneAt: null });
      expect((await setupRepository.placementsOf(siteId, [item.inventoryItemId], tx)).get(item.inventoryItemId)).toMatchObject({ sectionId: to!.id, position });

      expect((await setupRepository.latestMoveByItem(siteId, [item.inventoryItemId], tx)).get(item.inventoryItemId)?.id).toBe(made.id);
      expect(await setupRepository.movesSince(siteId, new Date(at.getTime() - 1000), 'someone-else', tx)).toEqual(expect.arrayContaining([expect.objectContaining({ id: made.id })]));
      expect(await setupRepository.movesSince(siteId, new Date(at.getTime() - 1000), userId, tx)).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: made.id })]));

      const back = await setupRepository.nextItemPosition(tx, from!.id);
      await setupRepository.rewritePlacements(tx, siteId, [{ itemId: item.inventoryItemId, sectionId: from!.id, position: back }]);
      expect(await setupRepository.markUndone(tx, siteId, made.id, userId, new Date())).toBe(true);
      expect(await setupRepository.markUndone(tx, siteId, made.id, userId, new Date())).toBe(false); // the second one loses
      expect((await setupRepository.findMove(siteId, made.id, tx))?.undoneAt).not.toBeNull();
      expect(await setupRepository.movesSince(siteId, new Date(at.getTime() - 1000), 'someone-else', tx)).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: made.id })]));
    });
  });

  it('an item with no section is placed, and taking the placement away makes it unsectioned again', async () => {
    const siteId = await hub();
    const userId = await user();
    const target = await prisma.countSection.findFirstOrThrow({ where: { siteId, name: 'Packaging' } });
    await inRolledBackTx(async (tx) => {
      const item = await newItem(tx, siteId);
      expect((await setupRepository.unsectionedItems(siteId, tx)).map((i) => i.id)).toContain(item.id);
      await setupRepository.insertPlacements(tx, siteId, [{ itemId: item.id, sectionId: target.id, position: 0, addedById: userId }]);
      expect((await setupRepository.unsectionedItems(siteId, tx)).map((i) => i.id)).not.toContain(item.id);
      expect((await setupRepository.listPlacedItems(siteId, [target.id], tx)).map((i) => i.itemId)).toContain(item.id);
      await setupRepository.deletePlacement(tx, siteId, item.id);
      expect((await setupRepository.unsectionedItems(siteId, tx)).map((i) => i.id)).toContain(item.id);
    });
  });

  it('a retired item drops out of the lists and the section counts', async () => {
    const siteId = await hub();
    const target = await prisma.countSection.findFirstOrThrow({ where: { siteId, name: 'Packaging' } });
    await inRolledBackTx(async (tx) => {
      const item = await newItem(tx, siteId);
      await setupRepository.insertPlacements(tx, siteId, [{ itemId: item.id, sectionId: target.id, position: 0, addedById: null }]);
      const before = (await setupRepository.listSections(siteId, tx)).find((s) => s.id === target.id)!.itemCount;
      await tx.inventoryItem.update({ where: { id: item.id }, data: { deletedAt: new Date() } });
      const after = (await setupRepository.listSections(siteId, tx)).find((s) => s.id === target.id)!.itemCount;
      expect(after).toBe(before - 1);
      expect((await setupRepository.listPlacedItems(siteId, [target.id], tx)).map((i) => i.itemId)).not.toContain(item.id);
    });
  });

  it('the layout rewrite sets sections and positions in one statement, and the version follows the layout', async () => {
    const siteId = await hub();
    await inRolledBackTx(async (tx) => {
      await setupRepository.lockLayout(tx, siteId);
      const stamp = async () => {
        const [sections, placed, unsectioned] = await Promise.all([setupRepository.listSections(siteId, tx), setupRepository.listPlacedItems(siteId, null, tx), setupRepository.unsectionedItems(siteId, tx)]);
        return layoutVersion({
          sections: sections.map((s) => ({ id: s.id, name: s.name, position: s.position })),
          placements: placed.map((p) => ({ itemId: p.itemId, sectionId: p.sectionId, position: p.position })),
          unsectionedItemIds: unsectioned.map((i) => i.id),
        });
      };
      const before = await stamp();
      expect(await stamp()).toBe(before); // reading changes nothing

      const sections = await setupRepository.listSections(siteId, tx);
      await setupRepository.rewriteSectionPositions(tx, siteId, [{ id: sections[0]!.id, position: 50 }, { id: sections[1]!.id, position: 49 }]);
      const after = await setupRepository.listSections(siteId, tx);
      expect(after.find((s) => s.id === sections[0]!.id)!.position).toBe(50);
      expect(after.find((s) => s.id === sections[1]!.id)!.position).toBe(49);
      expect(await stamp()).not.toBe(before);
    });
  });

  it('add-items: the search looks at every section, the tabs split the rest, and an item already in the section is never offered', async () => {
    const siteId = await hub();
    const target = await prisma.countSection.findFirstOrThrow({ where: { siteId, name: 'Packaging' } });
    const elsewhere = await prisma.countSection.findFirstOrThrow({ where: { siteId, items: { some: {} } } });
    await inRolledBackTx(async (tx) => {
      const unplaced = await newItem(tx, siteId, { name: 'Zzoat test milk' });
      const placedElsewhere = await newItem(tx, siteId, { name: 'Zzoat test flakes' });
      const inTarget = await newItem(tx, siteId, { name: 'Zzoat test bran' });
      await setupRepository.insertPlacements(tx, siteId, [
        { itemId: placedElsewhere.id, sectionId: elsewhere.id, position: 999, addedById: null },
        { itemId: inTarget.id, sectionId: target.id, position: 0, addedById: null },
      ]);
      const paging = { page: 1, pageSize: 50 };

      const search = await setupRepository.listAddable(siteId, { sectionId: target.id, tab: 'unsectioned', q: 'zzoat test' }, paging, tx);
      expect(search.rows.map((r) => r.name).sort()).toEqual(['Zzoat test flakes', 'Zzoat test milk']);
      expect(search.total).toBe(2);
      expect(search.rows.find((r) => r.name === 'Zzoat test flakes')?.section).toMatchObject({ id: elsewhere.id });
      expect(search.rows.find((r) => r.name === 'Zzoat test milk')?.section).toBeNull();
      expect(search.chips).toEqual({ unsectioned: 1, otherSections: 1 });

      const tab = await setupRepository.listAddable(siteId, { sectionId: target.id, tab: 'unsectioned' }, paging, tx);
      expect(tab.rows.map((r) => r.itemId)).toContain(unplaced.id);
      expect(tab.rows.map((r) => r.itemId)).not.toContain(placedElsewhere.id);
      expect(tab.rows.map((r) => r.itemId)).not.toContain(inTarget.id);

      const other = await setupRepository.listAddable(siteId, { sectionId: target.id, tab: 'other', q: undefined }, { page: 1, pageSize: 25 }, tx);
      expect(other.rows.length).toBeLessThanOrEqual(25);
      expect(other.rows.map((r) => r.itemId)).not.toContain(inTarget.id);
      expect(other.total).toBe(other.chips.otherSections);

      const nothing = await setupRepository.listAddable(siteId, { sectionId: target.id, tab: 'unsectioned', q: 'zz-no-such-item' }, paging, tx);
      expect(nothing).toMatchObject({ rows: [], total: 0 });
    });
  });
});
