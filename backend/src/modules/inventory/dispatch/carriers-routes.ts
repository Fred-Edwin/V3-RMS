import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/central-store-access';
import { dispatchController } from './dispatch-controller';

/**
 * Carriers (P10), all under /inventory/carriers (docs/features/inventory/dispatch-contract.md §4; Paper D18). Carriers live inside the
 * `dispatch/` module.
 *   GET /  (carriers.read)   POST /  (carriers.manage)   PATCH /:id  (carriers.manage: rename, retire with `active: false`, restore with `active: true`)
 * The Attendant picks a carrier from the active list that P4 returns, so they need no `carriers.read`.
 */
const router = Router();

router.use(authenticate);

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
router.param('id', (_req, _res, next, value: string) => (UUID.test(value) ? next() : next('route')));

router.get('/', requireCapability('carriers.read', 'carriers.manage'), dispatchController.listCarriers);
router.post('/', requireCapability('carriers.manage'), dispatchController.addCarrier);
router.patch('/:id', requireCapability('carriers.manage'), dispatchController.updateCarrier);

export default router;
