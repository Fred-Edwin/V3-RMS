import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';

/**
 * Branch waste, all under /inventory/branch-waste (docs/features/inventory/branch-waste-contract.md §4, BW1 to BW7).
 * A PLACEHOLDER until the Block 3 back end fills it: it authenticates and has no endpoint yet. The Department Head's three old
 * endpoints under /inventory/waste (`../department/waste-routes.ts`) keep running until this router replaces them.
 *
 * Logging, the department's own list and reversing your own entry are the department rule in the service (an active head or member of
 * a department of the branch; `branch_waste.log` and `branch_waste.reverse_own` are held by no role in the access table), so those routes
 * carry `authenticate` only, like Deliveries. The rest gate with `requireCapability(...)` from `_shared/central-store-access.ts`
 * (never a new `requireRole` list); the Branch Manager's own branch is a service rule. No PIN anywhere.
 *   BW1 GET /items   BW2 POST /   BW3 GET /mine   (department rule)
 *   BW4 GET /branch (branch_waste.read)   BW5 GET /branches (branch_waste.read_any_branch)
 *   BW6 GET /:id (a reader, or the department rule)   BW7 POST /:id/reverse (branch_waste.reverse_any, or the department rule)
 * `/items`, `/mine`, `/branch` and `/branches` sit BEFORE `/:id`, and `:id` only matches a uuid.
 */
const router = Router();

router.use(authenticate);

export default router;
