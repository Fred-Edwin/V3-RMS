import { Router } from 'express';
import entriesRoutes from './entries/entries-routes';
import logRoutes from './log/log-routes';
import reverseRoutes from './reverse/reverse-routes';

/**
 * The rebuilt Central Store waste routes, all under /inventory/stock/waste
 * (docs/features/inventory/stock-count-waste-contract.md §4). Landed by the orchestrator; a build session edits the folder
 * routers, not this file. A Department Head's branch waste keeps the old `/inventory/waste` routes, untouched, until
 * `waste-routes.ts` moves into `waste/department/` at release. Each router authenticates and gates by capability itself.
 *   log      GET /waste/items, POST /waste
 *   entries  GET /waste
 *   reverse  POST /waste/:id/reverse
 */
const router = Router();

router.use('/inventory/stock/waste', logRoutes);
router.use('/inventory/stock/waste', entriesRoutes);
router.use('/inventory/stock/waste', reverseRoutes);

export default router;
