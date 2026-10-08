import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { overviewController } from './overview-controller';

/** Stock, `overview/`: the Overview hub (S1), `stock.read`. Mounted by `stock-hub-routes.ts` under /inventory/stock. */
const router = Router();

router.use(authenticate);

router.get('/overview', requireCapability('stock.read'), overviewController.get);

export default router;
