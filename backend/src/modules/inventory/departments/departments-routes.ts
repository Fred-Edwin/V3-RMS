import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';

/**
 * Departments as data, all under /inventory/departments (docs/features/inventory/requisitions-contract.md §4.3).
 * A PLACEHOLDER until back end A fills it: it authenticates and has no endpoint yet. Each route gates itself with
 * `requireCapability('departments.read' | 'departments.write')` and the own-branch rule in the service.
 *   R23 GET /   R24 POST /   R25 PATCH /:id   R26 POST /:id/retire and POST /:id/restore
 */
const router = Router();

router.use(authenticate);

export default router;
