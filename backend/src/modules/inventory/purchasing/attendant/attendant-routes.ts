import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { attendantController } from './attendant-controller';

const router = Router();

router.use(authenticate);

// The Store Attendant's Purchasing phone (Paper 28A to 28Q). Everything is read for `orders.read`; the service shapes what each caller sees
// (the blind rule), and the figures of on hand and reorder level need `orders.see_stock` or `restock.read`.
router.get('/attendant/home', requireCapability('orders.read'), attendantController.getHome);
router.get('/attendant/badges', requireCapability('orders.read'), attendantController.getBadges);
router.get('/attendant/my-orders', requireCapability('orders.read'), attendantController.getMyOrders);
router.get('/attendant/history', requireCapability('orders.read'), attendantController.getHistory);
router.get('/attendant/search', requireCapability('orders.read'), attendantController.search);
router.get('/attendant/suppliers/:id', requireCapability('orders.read'), attendantController.getSupplier);
router.get('/attendant/restock-levels', requireCapability('orders.see_stock', 'restock.read'), attendantController.getRestockLevels);

// Notifications: the caller's own, derived from the orders; only "opened" marks are stored.
router.get('/attendant/notifications', requireCapability('orders.read'), attendantController.getNotices);
router.post('/attendant/notifications/read', requireCapability('orders.read'), attendantController.markNoticesRead);
router.post('/attendant/notifications/read-all', requireCapability('orders.read'), attendantController.markAllNoticesRead);

export default router;
