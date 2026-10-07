import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { needsRestockingController } from './needs-restocking-controller';

const router = Router();

router.use(authenticate);

router.get('/needs-restocking', requireCapability('orders.read', 'orders.request'), needsRestockingController.getNeeds);

// The catalog is what a person picks from when raising an order, so it follows `orders.request`.
router.get('/catalog', requireCapability('orders.request'), needsRestockingController.getCatalog);

export default router;
