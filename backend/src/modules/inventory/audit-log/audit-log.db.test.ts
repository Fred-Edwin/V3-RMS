/**
 * The Audit log against the REAL database (opt-in, `RUN_DB_TESTS=1`; it only reads). The mocked tests prove the sentences and
 * the merge; this proves every query of the new areas (Stock counts, Waste, Stock adjustments) is valid Prisma and answers the
 * shape the service expects, with an open range, a closed range and a "who" filter, and that the whole list runs per area.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../config/database';
import type { Scope } from './audit-log-repository';
import { auditLogService } from './audit-log-service';
import { AUDIT_AREAS } from './audit-log.types';
import { AuditLogQuerySchema } from './audit-log-validators';
import { stockAdjustmentsSource } from './sources/stock-adjustments-source';
import { stockCountsSource } from './sources/stock-counts-source';
import { wasteSource } from './sources/waste-source';

const enabled = process.env['RUN_DB_TESTS'] === '1';

describe.skipIf(!enabled)('audit log against the real database', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('every derived source runs with an open range, a closed range and a who filter', async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true } });
    const scope: Scope = { hubId: hub.id, restockOrgIds: [hub.id], peopleOrgIds: [hub.id] };
    const user = await prisma.user.findFirstOrThrow({ where: { siteId: hub.id } });
    const filters = [{}, { from: new Date('2020-01-01T00:00:00Z'), to: new Date('2100-01-01T00:00:00Z') }, { actorId: user.id }, { from: new Date('2100-01-01T00:00:00Z') }];
    for (const source of [stockCountsSource, wasteSource, stockAdjustmentsSource]) {
      for (const filter of filters) {
        const [entries, total, people] = await Promise.all([source.entries(scope, filter, 5), source.count(scope, filter), source.actorIds(scope, filter)]);
        expect(total).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(people)).toBe(true);
        for (const entry of entries) {
          expect(entry.area).toBe(source.area);
          expect(entry.what.length).toBeGreaterThan(0);
          expect(entry.record).toBeDefined();
        }
      }
      // A range in the far future has nothing in it.
      expect(await source.count(scope, { from: new Date('2100-01-01T00:00:00Z') })).toBe(0);
    }
  });

  it('the whole list runs for every area, and for the Branch filter', async () => {
    const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true } });
    const manager = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER', siteId: hub.id } });
    const actor = { id: manager.id, role: manager.role, siteId: manager.siteId } as never;
    const branch = await prisma.site.findFirst({ where: { isHub: false, isActive: true } });
    for (const area of AUDIT_AREAS) {
      const page = await auditLogService.list(actor, AuditLogQuerySchema.parse({ area }));
      expect(page.pagination.page).toBe(1);
      expect(page.entries.every((e) => e.area === area || area === 'PURCHASING' || area === 'PAYMENTS')).toBe(true);
    }
    const all = await auditLogService.list(actor, AuditLogQuerySchema.parse({ perPage: 100 }));
    expect(all.entries.length).toBeLessThanOrEqual(100);
    if (branch) {
      const narrowed = await auditLogService.list(actor, AuditLogQuerySchema.parse({ branchId: branch.id }));
      // With the Branch filter on, only the areas a branch can have entries in answer (the hub's own areas answer nothing).
      const branchAreas: readonly string[] = ['RESTOCK_LEVELS', 'REQUISITIONS', 'DISPATCH', 'DISCREPANCIES', 'BRANCH_DAY', 'BRANCH_WASTE'];
      expect(narrowed.entries.every((e) => branchAreas.includes(e.area))).toBe(true);
    }
  });
});
