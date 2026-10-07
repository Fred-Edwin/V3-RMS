import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { supplierAccountController } from './supplier-account-controller';

const router = Router();

router.use(authenticate);

// The supplier page is for those who read suppliers; the Store Attendant has only the stripped picker list.
router.get('/suppliers/:id/orders', requireCapability('suppliers.read'), supplierAccountController.getOrders);
router.get('/suppliers/:id/statement', requireCapability('payables.read'), supplierAccountController.getStatement);

export default router;
