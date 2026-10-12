import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/central-store-access';
import { departmentsController } from './departments-controller';

/**
 * Departments as data, all under /inventory/departments (docs/features/inventory/requisitions-contract.md §4.3).
 * Every route authenticates and gates by capability; the own-branch rule for writes lives in the service.
 *   R23 GET /   R24 POST /   R25 PATCH /:id   R26 POST /:id/retire and POST /:id/restore
 */
const router = Router();

router.use(authenticate);

router.get('/', requireCapability('departments.read', 'departments.write'), departmentsController.list);
router.post('/', requireCapability('departments.write'), departmentsController.add);
router.patch('/:id', requireCapability('departments.write'), departmentsController.rename);
router.post('/:id/retire', requireCapability('departments.write'), departmentsController.retire);
router.post('/:id/restore', requireCapability('departments.write'), departmentsController.restore);

export default router;
