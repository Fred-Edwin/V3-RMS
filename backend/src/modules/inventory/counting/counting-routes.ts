import { Router } from 'express';
import printRoutes from './print/print-routes';
import recordRoutes from './record/record-routes';
import reviewRoutes from './review/review-routes';
import countsRoutes from './counts/counts-routes';
import setupRoutes from './setup/setup-routes';
import settingsRoutes from './settings/settings-routes';

/**
 * Every Counting route lives under /inventory/stock (docs/features/inventory/stock-count-waste-contract.md §4). This file is
 * landed by the orchestrator and is not edited by a build session: each folder's router is. The order below is part of the
 * contract, because `GET /counts/:id` matches any single segment and must come after every literal path:
 *   print     GET /counts/blank-sheet, GET /counts/:id/print
 *   record    GET /counts/start-options, POST /counts, PUT /counts/section-order/today, PUT /counts/:id/lines, ...
 *   review    POST /counts/seen, POST /counts/:id/decisions, ...
 *   counts    GET /counts/summary, /counts/flagged, /counts/repeat-shortfalls, /counts, /counts/:id   (last)
 *   setup     /count-setup/...
 *   settings  /count-settings/...
 * Each router authenticates and gates by capability itself (`requireCapability`, never `requireRole`).
 */
const router = Router();

router.use('/inventory/stock', printRoutes);
router.use('/inventory/stock', recordRoutes);
router.use('/inventory/stock', reviewRoutes);
router.use('/inventory/stock', countsRoutes);
router.use('/inventory/stock', setupRoutes);
router.use('/inventory/stock', settingsRoutes);

export default router;
