import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';

/**
 * Discrepancies, all under /inventory/discrepancies (docs/features/inventory/dispatch-contract.md §4, Q1 to Q5).
 * A PLACEHOLDER until back end D fills it: it authenticates and has no endpoint yet. The old router in `dispatch/dispatch-routes.ts`
 * (paths under /discrepancies) keeps running until back end C deletes it.
 *
 * Each route gates itself with `requireCapability(...)` from `_shared/central-store-access.ts` (never a new `requireRole` list); a
 * Branch Manager's own branch and a department head's own department are service rules.
 *   Q1 GET / (discrepancies.read)   Q2 GET /:id (discrepancies.read)   Q3 GET /:id/finding-preview?finding= (discrepancies.record)
 *   Q4 POST /:id/findings (discrepancies.record)   Q5 POST /:id/reverse (discrepancies.reverse)
 */
const router = Router();

router.use(authenticate);

export default router;
