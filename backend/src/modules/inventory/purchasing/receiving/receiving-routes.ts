import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { receivingController } from './receiving-controller';

const router = Router();

router.use(authenticate);

// The Store Attendant receives on the phone; the Store Manager and System Admin can too.
router.post('/orders/:id/receive', requireCapability('orders.receive'), receivingController.receive);

export default router;
