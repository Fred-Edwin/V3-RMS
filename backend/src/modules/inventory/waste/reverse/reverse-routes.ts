import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { reverseController } from './reverse-controller';

/**
 * Waste, `reverse/`: reversing an entry (W4). The capability lets either reverse row through; the service rule decides
 * between "any entry" and "my own entry, the same Nairobi day". Mounted by `waste-hub-routes.ts` under /inventory/stock/waste.
 */
const router = Router();

router.use(authenticate);

router.post('/:id/reverse', requireCapability('waste.reverse_any', 'waste.reverse_own'), reverseController.reverse);

export default router;
