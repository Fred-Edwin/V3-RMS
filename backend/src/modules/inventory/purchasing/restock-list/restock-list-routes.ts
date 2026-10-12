import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { restockListController } from './restock-list-controller';

const router = Router();

router.use(authenticate);

// Raising orders from the restock list is `orders.request`, the same right as saving a draft. Both are POST because the list is the body.
router.post('/restock-list/review', requireCapability('orders.request'), restockListController.review);
router.post('/restock-list/send', requireCapability('orders.request'), restockListController.send);

export default router;
