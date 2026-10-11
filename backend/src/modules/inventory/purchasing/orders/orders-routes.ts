import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { ordersController } from './orders-controller';

const router = Router();

router.use(authenticate);

// Reads: every order, read-only, for anyone who holds `orders.read` (the blind rule shapes what they see).
router.get('/summary', requireCapability('orders.read'), ordersController.getSummary);
router.get('/orders', requireCapability('orders.read'), ordersController.list);
router.get('/orders/:id', requireCapability('orders.read'), ordersController.getOne);
router.get('/orders/:id/lpo', requireCapability('orders.read'), ordersController.getLpoPrint);
router.get('/orders/:id/whatsapp', requireCapability('orders.approve', 'orders.request'), ordersController.getWhatsapp);

// Writes: by capability, never by role name.
router.post('/orders', requireCapability('orders.request'), ordersController.create);
router.patch('/orders/:id', requireCapability('orders.request'), ordersController.update);
router.delete('/orders/:id', requireCapability('orders.request'), ordersController.discard);
router.post('/orders/:id/submit', requireCapability('orders.request'), ordersController.submit);
router.post('/orders/:id/approve', requireCapability('orders.approve'), ordersController.approve);
router.post('/orders/:id/return', requireCapability('orders.approve'), ordersController.returnOrder);
router.post('/orders/:id/send', requireCapability('orders.approve', 'orders.request'), ordersController.send);
router.post('/orders/:id/cancel', requireCapability('orders.cancel'), ordersController.cancel);

// The Store Attendant's phone (Paper 28D, 28H, 28K). `orders.request` is the raiser's right; the service checks it is their own order.
router.get('/collectors', requireCapability('orders.approve', 'orders.request'), ordersController.getCollectors);
router.put('/orders/:id/collected-by', requireCapability('orders.approve', 'orders.request'), ordersController.setCollectedBy);
router.post('/orders/:id/withdraw', requireCapability('orders.request'), ordersController.withdraw);
router.post('/orders/:id/remind', requireCapability('orders.request'), ordersController.remind);

export default router;
