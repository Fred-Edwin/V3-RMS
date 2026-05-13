import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { orderCancellationAuthController } from '../controllers/order-cancellation-auth-controller';

const orderCancellationAuthRoutes = Router();

orderCancellationAuthRoutes.get(
  '/order-cancellation-auth',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  orderCancellationAuthController.listPending,
);

orderCancellationAuthRoutes.get(
  '/order-cancellation-auth/:authRequestId',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER'),
  orderCancellationAuthController.getById,
);

orderCancellationAuthRoutes.get(
  '/orders/:orderId/cancellation-auth',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER'),
  orderCancellationAuthController.getPendingByOrderId,
);

orderCancellationAuthRoutes.post(
  '/order-cancellation-auth/:authRequestId/override',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  orderCancellationAuthController.override,
);

export default orderCancellationAuthRoutes;
