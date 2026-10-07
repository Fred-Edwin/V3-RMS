import { prisma } from '../../../config/database';
import type { AuditLogQuery } from './audit-log-validators';

/**
 * Reads for the Audit log. Four sources, each filtered by organization first:
 * item history and supplier audit rows and suppliers belong to the hub; restock level changes belong to the
 * location's organization, which is the hub (Central Store) or a branch (a department's levels).
 */

export interface Scope {
  hubId: string;
  /** The hub and its active branches, for restock changes made at a branch department. */
  restockOrgIds: string[];
}

export type PurchasingArea = 'PURCHASING' | 'PAYMENTS';

type Filter = Pick<AuditLogQuery, 'from' | 'to' | 'actorId'>;

const when = (f: Filter) => (f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {});
const whenAt = (f: Filter) => (f.from || f.to ? { at: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {});
const by = (f: Filter, field: string) => (f.actorId ? { [field]: f.actorId } : {});
const order = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
const who = { select: { id: true, name: true } };

export const auditLogRepository = {
  itemChanges: (scope: Scope, f: Filter, take: number) =>
    prisma.inventoryItemChange.findMany({
      where: { siteId: scope.hubId, ...when(f), ...by(f, 'changedById') },
      include: { changedBy: who, inventoryItem: { select: { name: true } } },
      orderBy: order,
      take,
    }),
  countItemChanges: (scope: Scope, f: Filter) => prisma.inventoryItemChange.count({ where: { siteId: scope.hubId, ...when(f), ...by(f, 'changedById') } }),

  supplierAudits: (scope: Scope, f: Filter, take: number) =>
    prisma.supplierAuditLog.findMany({
      where: { siteId: scope.hubId, ...when(f), ...by(f, 'actorId') },
      include: { actor: who, supplier: { select: { name: true } } },
      orderBy: order,
      take,
    }),
  countSupplierAudits: (scope: Scope, f: Filter) => prisma.supplierAuditLog.count({ where: { siteId: scope.hubId, ...when(f), ...by(f, 'actorId') } }),

  /** Suppliers that have a recorded creator (older rows may not). */
  suppliersCreated: (scope: Scope, f: Filter, take: number) =>
    prisma.supplier.findMany({
      where: { siteId: scope.hubId, createdById: f.actorId ?? { not: null }, ...when(f) },
      select: { id: true, name: true, code: true, createdAt: true, createdById: true },
      orderBy: order,
      take,
    }),
  countSuppliersCreated: (scope: Scope, f: Filter) => prisma.supplier.count({ where: { siteId: scope.hubId, createdById: f.actorId ?? { not: null }, ...when(f) } }),

  restockChanges: (scope: Scope, f: Filter, take: number) =>
    prisma.restockLevelChange.findMany({
      where: { siteId: { in: scope.restockOrgIds }, ...when(f), ...by(f, 'changedById') },
      include: {
        changedBy: who,
        inventoryItem: { select: { name: true, usageUnit: true } },
        location: { select: { type: true, departmentTag: true, site: { select: { name: true } } } },
      },
      orderBy: order,
      take,
    }),
  countRestockChanges: (scope: Scope, f: Filter) => prisma.restockLevelChange.count({ where: { siteId: { in: scope.restockOrgIds }, ...when(f), ...by(f, 'changedById') } }),

  /** Purchasing and Payments rows (the purchase file's own audit). `areas` is the subset the caller asked for. */
  purchasingEntries: (scope: Scope, f: Filter, areas: PurchasingArea[], take: number) =>
    prisma.purchasingAuditEntry.findMany({
      where: { siteId: scope.hubId, area: { in: areas }, ...whenAt(f), ...by(f, 'actorId') },
      include: {
        actor: { select: { id: true, name: true, role: true } },
        order: { select: { id: true, reference: true } },
        supplier: { select: { name: true } },
      },
      orderBy: [{ at: 'desc' as const }, { id: 'desc' as const }],
      take,
    }),
  countPurchasingEntries: (scope: Scope, f: Filter, areas: PurchasingArea[]) =>
    prisma.purchasingAuditEntry.count({ where: { siteId: scope.hubId, area: { in: areas }, ...whenAt(f), ...by(f, 'actorId') } }),

  /** Prep: every usual-recipe version is an entry (version 1 "Recipe set", later ones "Recipe changed"). The version rows are the log. */
  recipeVersions: (scope: Scope, f: Filter, take: number) =>
    prisma.prepRecipeVersion.findMany({
      where: { siteId: scope.hubId, ...when(f), ...by(f, 'createdById') },
      select: {
        id: true,
        version: true,
        reason: true,
        reasonNote: true,
        createdAt: true,
        createdBy: who,
        recipe: { select: { outputItem: { select: { name: true } } } },
      },
      orderBy: order,
      take,
    }),
  countRecipeVersions: (scope: Scope, f: Filter) => prisma.prepRecipeVersion.count({ where: { siteId: scope.hubId, ...when(f), ...by(f, 'createdById') } }),

  /** Names for the ids found in supplier audit snapshots, and for suppliers' creators. */
  itemNames: async (scope: Scope, ids: string[]): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await prisma.inventoryItem.findMany({ where: { siteId: scope.hubId, id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },
  userNames: async (scope: Scope, ids: string[]): Promise<Map<string, string>> => {
    if (ids.length === 0) return new Map();
    const rows = await prisma.user.findMany({ where: { siteId: { in: scope.restockOrgIds }, id: { in: ids } }, select: { id: true, name: true } });
    return new Map(rows.map((r) => [r.id, r.name]));
  },

  /** Everyone who changed something in the period (the "Who" list), ignoring the Who filter. */
  actorIds: async (scope: Scope, f: Pick<Filter, 'from' | 'to'>): Promise<string[]> => {
    const [items, audits, restock, suppliers, purchasing, recipes] = await Promise.all([
      prisma.inventoryItemChange.findMany({ where: { siteId: scope.hubId, ...when(f) }, select: { changedById: true }, distinct: ['changedById'] }),
      prisma.supplierAuditLog.findMany({ where: { siteId: scope.hubId, ...when(f) }, select: { actorId: true }, distinct: ['actorId'] }),
      prisma.restockLevelChange.findMany({ where: { siteId: { in: scope.restockOrgIds }, ...when(f) }, select: { changedById: true }, distinct: ['changedById'] }),
      prisma.supplier.findMany({ where: { siteId: scope.hubId, createdById: { not: null }, ...when(f) }, select: { createdById: true }, distinct: ['createdById'] }),
      prisma.purchasingAuditEntry.findMany({ where: { siteId: scope.hubId, ...whenAt(f) }, select: { actorId: true }, distinct: ['actorId'] }),
      prisma.prepRecipeVersion.findMany({ where: { siteId: scope.hubId, ...when(f) }, select: { createdById: true }, distinct: ['createdById'] }),
    ]);
    return [...new Set([...recipes.map((r) => r.createdById), ...purchasing.map((r) => r.actorId), ...items.map((r) => r.changedById), ...audits.map((r) => r.actorId), ...restock.map((r) => r.changedById), ...suppliers.map((r) => r.createdById).filter((id): id is string => id !== null)])];
  },
};
