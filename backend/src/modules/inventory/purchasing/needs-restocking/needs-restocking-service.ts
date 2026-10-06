import type { Request } from 'express';
import { locationRepository } from '../../../../repositories/location-repository';
import { NotFoundError } from '../../../../utils/errors';
import { withoutStockFigures } from '../../_shared/blind-rule';
import { requireHubReader } from '../../_shared/central-store-access';
import { buildCatalog, buildNeeds } from './needs-restocking-logic';
import { needsRestockingRepository, type Scope } from './needs-restocking-repository';
import type { CatalogQuery, CatalogResult, NeedsQuery, NeedsRestocking } from './needs-restocking.types';

type Actor = NonNullable<Request['user']>;

const scopeOf = async (actor: Actor): Promise<Scope> => {
  const siteId = await requireHubReader(actor);
  const centralStore = await locationRepository.findCentralStore();
  if (!centralStore || centralStore.siteId !== siteId) throw new NotFoundError('No Central Store is configured for this organization');
  return { siteId, locationId: centralStore.id };
};

export const needsRestockingService = {
  /**
   * Items below their restock level across suppliers, grouped by each item's default supplier. The Store Attendant gets
   * the same list (Low and Out only) without the on-hand and level figures: those are stock figures (blind rule).
   */
  getNeeds: async (actor: Actor, query: NeedsQuery): Promise<NeedsRestocking> => {
    const scope = await scopeOf(actor);
    const items = await needsRestockingRepository.findBelowLevel(scope, query.q);
    const [lines, suppliers] = await Promise.all([
      needsRestockingRepository.findSupplierLines(
        scope.siteId,
        items.map((i) => i.id),
      ),
      needsRestockingRepository.findOrderableSuppliers(scope.siteId),
    ]);
    const needs = buildNeeds(items, lines, suppliers, query);
    return { ...needs, groups: needs.groups.map((g) => ({ ...g, lines: g.lines.map((l) => withoutStockFigures(actor, l)) })) };
  },

  /** How many items need restocking, for the tab badge (the same list, counted). */
  countNeeds: async (actor: Actor): Promise<number> => (await needsRestockingService.getNeeds(actor, {})).itemCount,

  /** The supplier's catalog for the New order screen. */
  getCatalog: async (actor: Actor, query: CatalogQuery): Promise<CatalogResult> => {
    const scope = await scopeOf(actor);
    const lines = await needsRestockingRepository.findLinesForSupplier(scope.siteId, query.supplierId, query.q);
    const stock = await needsRestockingRepository.findStockForItems(
      scope,
      lines.map((l) => l.inventoryItemId),
    );
    const result = buildCatalog(lines, stock, query);
    return { ...result, items: result.items.map((i) => withoutStockFigures(actor, i)) };
  },
};
