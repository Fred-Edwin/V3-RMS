import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';

/**
 * Carriers (P10), all under /inventory/carriers (docs/features/inventory/dispatch-contract.md §4; Paper D18). Carriers live inside the
 * `dispatch/` module. A PLACEHOLDER until back end C fills it: it authenticates and has no endpoint yet.
 *   GET /  (carriers.read)   POST /  (carriers.manage)   PATCH /:id  (carriers.manage: rename, retire with `active: false`, restore with `active: true`)
 * The Attendant picks a carrier from the active list that P4 returns, so they need no `carriers.read`.
 */
const router = Router();

router.use(authenticate);

export default router;
