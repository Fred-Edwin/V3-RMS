import { Router } from 'express';
import { orderController } from '../controllers/order-controller';
import { splitLineController } from '../controllers/split-line-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const orderRoutes = Router();

orderRoutes.get(
  '/orders',
  authenticate,
  branchScope,
  requireRole('WAITER', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'CHEF', 'BARISTA'),
  orderController.getOrders,
);

orderRoutes.get(
  '/orders/active',
  authenticate,
  branchScope,
  requireRole('WAITER', 'MANAGER', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'),
  orderController.getActiveOrders,
);

orderRoutes.get(
  '/orders/:id',
  authenticate,
  branchScope,
  requireRole('WAITER', 'MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'CHEF', 'BARISTA'),
  orderController.getOrderById,
);

orderRoutes.post(
  '/orders',
  authenticate,
  branchScope,
  requireRole('WAITER'),
  orderController.createOrder,
);

orderRoutes.patch(
  '/orders/:id/items',
  authenticate,
  branchScope,
  requireRole('WAITER'),
  orderController.updateOrderItems,
);

orderRoutes.patch(
  '/orders/:id/payment',
  authenticate,
  branchScope,
  requireRole('WAITER'),
  orderController.recordPayment,
);

orderRoutes.patch(
  '/orders/:id/cancel',
  authenticate,
  branchScope,
  requireRole('WAITER', 'MANAGER'),
  orderController.cancelOrder,
);

orderRoutes.patch(
  '/orders/:id/manager-edit',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  orderController.managerRemoveItems,
);

orderRoutes.patch(
  '/orders/:id/account',
  authenticate,
  branchScope,
  requireRole('ACCOUNTANT', 'SYSTEM_ADMIN'),
  orderController.accountOrder,
);

// Guest split payment lines
orderRoutes.post(
  '/orders/:id/split-lines',
  authenticate,
  branchScope,
  requireRole('WAITER'),
  splitLineController.addLine,
);

orderRoutes.get(
  '/orders/:id/split-lines',
  authenticate,
  branchScope,
  requireRole('WAITER', 'MANAGER', 'DIRECTOR'),
  splitLineController.getLines,
);

orderRoutes.delete(
  '/orders/:id/split-lines/:lineId',
  authenticate,
  branchScope,
  requireRole('WAITER'),
  splitLineController.removeLine,
);

export default orderRoutes;
