import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { branchWasteController } from './branch-controller';

/**
 * Branch waste, all under /inventory/branch-waste (docs/features/inventory/branch-waste-contract.md §4, BW1 to BW7).
 *
 * Logging, the department's own list and reversing your own entry are the department rule in the service (an active head or member of
 * an active department of the branch; `branch_waste.log` and `branch_waste.reverse_own` are held by no role in the access table), so
 * those routes carry `authenticate` only, like Deliveries. The desktop reads gate with `requireCapability(...)` from
 * `_shared/central-store-access.ts` (never a new `requireRole` list); the Branch Manager's own-branch rule is in the service.
 * BW6 and BW7 take a reader (any capability row) or the department rule, which only the service can tell apart. No PIN anywhere.
 *   BW1 GET /items   BW2 POST /   BW3 GET /mine   (department rule)
 *   BW4 GET /branch (branch_waste.read)   BW5 GET /branches (branch_waste.read_any_branch)
 *   BW6 GET /:id (a reader, or the department rule)   BW7 POST /:id/reverse (branch_waste.reverse_any, or the department rule)
 * `/items`, `/mine`, `/branch` and `/branches` sit BEFORE `/:id`, and `:id` only matches a uuid.
 */
const router = Router();

router.use(authenticate);

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
router.param('id', (_req, _res, next, value: string) => (UUID.test(value) ? next() : next('route')));

router.get('/items', branchWasteController.listItems); // BW1
router.post('/', branchWasteController.log); // BW2
router.get('/mine', branchWasteController.listMine); // BW3
router.get('/branch', requireCapability('branch_waste.read'), branchWasteController.listBranch); // BW4
router.get('/branches', requireCapability('branch_waste.read_any_branch'), branchWasteController.listBranches); // BW5
router.get('/:id', branchWasteController.detail); // BW6
router.post('/:id/reverse', branchWasteController.reverse); // BW7

export default router;
