import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { entriesController } from './entries-controller';

/**
 * Waste, `entries/`: the waste list and its KPI strip (W3). Mounted by `waste-hub-routes.ts` under /inventory/stock/waste.
 * The Attendant holds `waste.read` and gets their own entries only: that is the service's rule, not the route's.
 */
const router = Router();

router.use(authenticate);

router.get('/', requireCapability('waste.read'), entriesController.list);

export default router;
