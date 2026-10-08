import type { DepartmentTag, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * The dual-write hook of the expand phase (docs/features/inventory/requisitions-contract.md §2.1). Every write that sets
 * `InventoryItem.departmentTags`, `User.departmentTag` or `Location.departmentTag` calls one of these in the same
 * transaction, so the id-based link never drifts from the legacy enum. Reads in new code use the ids only.
 * Database access only; no rules. Removed with the legacy columns in the Block 4 contract migration.
 */
/** The original five, in the order the screens list them. `key` is the legacy enum value. */
export const ORIGINAL_DEPARTMENTS: ReadonlyArray<{ name: string; key: DepartmentTag }> = [
  { name: 'Kitchen', key: 'KITCHEN' },
  { name: 'Barista', key: 'BARISTA' },
  { name: 'Pastry', key: 'PASTRY' },
  { name: 'Service', key: 'SERVICE' },
  { name: 'Housekeeping', key: 'HOUSEKEEPING' },
];

export const departmentLinks = {
  /**
   * Gives a new branch what the migration gave the existing ones: a three-letter code (the first letters of its name, one letter
   * changed on a clash; the owner corrects it in Settings) and the five original departments. Idempotent.
   */
  provisionBranch: async (site: { id: string; name: string; code?: string | null }, db: Db = prisma): Promise<void> => {
    if (!site.code) {
      const base = (site.name.replace(/[^A-Za-z]/g, '') + 'XXX').slice(0, 3).toUpperCase();
      let candidate = base;
      for (let i = 0; i < 26 && (await db.site.findFirst({ where: { code: candidate }, select: { id: true } })); i += 1) {
        candidate = base.slice(0, 2) + String.fromCharCode(65 + i);
      }
      await db.site.update({ where: { id: site.id }, data: { code: candidate } });
    }
    await db.department.createMany({
      data: ORIGINAL_DEPARTMENTS.map((d, i) => ({ siteId: site.id, name: d.name, key: d.key, position: i + 1 })),
      skipDuplicates: true,
    });
  },

  /**
   * The department row for (branch, legacy key), or null when the branch has none (no key, or a branch that was never seeded).
   * Retired departments still resolve: a person keeps their department when it is retired.
   */
  idForKey: async (siteId: string, key: DepartmentTag | null | undefined, db: Db = prisma): Promise<string | null> => {
    if (!key) return null;
    const row = await db.department.findFirst({ where: { siteId, key }, select: { id: true } });
    return row?.id ?? null;
  },

  /**
   * Makes the item's links to the ORIGINAL five departments match `tags`, and leaves its links to added departments (key null)
   * alone. A Central Store item (a hub or any non-branch site) is tagged in every branch; a branch item only in its own branch.
   */
  syncItemTags: async (item: { id: string; siteId: string }, tags: readonly DepartmentTag[], db: Db = prisma): Promise<void> => {
    const owner = await db.site.findFirst({ where: { id: item.siteId }, select: { type: true } });
    const branchScope = owner?.type === 'BRANCH' ? { siteId: item.siteId } : { site: { type: 'BRANCH' as const } };
    await db.itemDepartment.deleteMany({
      where: { itemId: item.id, department: { key: { not: null, notIn: [...tags] } } },
    });
    if (tags.length === 0) return;
    const wanted = await db.department.findMany({ where: { key: { in: [...tags] }, ...branchScope }, select: { id: true } });
    if (wanted.length === 0) return;
    await db.itemDepartment.createMany({ data: wanted.map((d) => ({ itemId: item.id, departmentId: d.id })), skipDuplicates: true });
  },
};
