import { Router } from 'express';
import historyRoutes from './history/history-routes';
import itemsRoutes from './items/items-routes';
import overviewRoutes from './overview/overview-routes';

/**
 * The rebuilt Stock screens (Overview, All items, Stock ledger, Stock card), all under /inventory/stock
 * (docs/features/inventory/stock-count-waste-contract.md §4). Landed by the orchestrator; a build session edits the folder
 * routers, not this file. The old `stock-routes.ts` keeps `/inventory/stock`, `/summary` and `/items/:itemId/ledger` until it
 * is deleted at release, so the new paths below avoid all three. Each router authenticates and gates by capability itself.
 *   overview  GET /overview
 *   items     GET /items
 *   history   GET /ledger, /ledger/export, /ledger/:itemId   (export before :itemId)
 */
const router = Router();

router.use('/inventory/stock', overviewRoutes);
router.use('/inventory/stock', itemsRoutes);
router.use('/inventory/stock', historyRoutes);

export default router;
