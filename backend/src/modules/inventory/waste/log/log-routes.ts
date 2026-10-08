import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { logController } from './log-controller';

/**
 * Waste, `log/`: logging waste at the Central Store (W1 the item picker, W2 log one or several items).
 * Mounted by `waste-hub-routes.ts` under /inventory/stock/waste.
 */
const router = Router();

router.use(authenticate);

router.get('/items', requireCapability('waste.log'), logController.listItems);
router.post('/', requireCapability('waste.log'), logController.log);

export default router;
