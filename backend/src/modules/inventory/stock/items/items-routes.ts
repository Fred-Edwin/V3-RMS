import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { itemsController } from './items-controller';

/** Stock, `items/`: All items (S2), `stock.read`. Mounted by `stock-hub-routes.ts` under /inventory/stock. */
const router = Router();

router.use(authenticate);

router.get('/items', requireCapability('stock.read'), itemsController.list);

export default router;
