import type { Request } from 'express';
import { locationRepository } from '../../../../repositories/location-repository';
import { NotFoundError } from '../../../../utils/errors';
import { withoutStockFigures } from '../../_shared/blind-rule';
import { actorCan, requireHubReader } from '../../_shared/central-store-access';
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

/**
 * On hand and the reorder level are stock figures (blind rule), but on the Purchasing screens `orders.see_stock` opens them
 * (owner, 10 Oct 2026: the Attendant's restock list reads "0 left · reorder at 8 jerrican", Paper 28B).
 */
const stripStock = <T extends object>(actor: Actor, value: T): T => (actorCan(actor, 'orders.see_stock') ? value : withoutStockFigures(actor, value));

export const needsRestockingService = {
  /**
   * Items below their restock level across suppliers, grouped by each item's default supplier. A caller without
   * `restock.read` or `orders.see_stock` gets the list (Low and Out only) without the on-hand and level figures.
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
    return { ...needs, groups: needs.groups.map((g) => ({ ...g, lines: g.lines.map((l) => stripStock(actor, l)) })) };
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
    return { ...result, items: result.items.map((i) => stripStock(actor, i)) };
  },
};
