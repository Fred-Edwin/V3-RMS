import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { orderCorrectionController } from '../controllers/order-correction-controller';

const orderCorrectionRoutes = Router();

// All routes in this file are SYSTEM_ADMIN only.
// Literal sub-paths registered before parameterised /:id to avoid Express collisions.

orderCorrectionRoutes.get(
  '/admin/order-corrections',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.listOrders,
);

orderCorrectionRoutes.get(
  '/admin/order-corrections/:id',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.getOrderDetail,
);

orderCorrectionRoutes.get(
  '/admin/order-corrections/:id/audit-log',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.getAuditLog,
);

orderCorrectionRoutes.patch(
  '/admin/order-corrections/:id/mpesa-code',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.correctMpesaCode,
);

orderCorrectionRoutes.patch(
  '/admin/order-corrections/:id/payment-method',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.correctPaymentMethod,
);

orderCorrectionRoutes.post(
  '/admin/order-corrections/:id/force-ready',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.forceOrderReady,
);

orderCorrectionRoutes.post(
  '/admin/order-corrections/:id/revert-auth',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.revertAwaitingAuth,
);

orderCorrectionRoutes.patch(
  '/admin/order-corrections/:id/items/:itemId/remove',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.removeOrderItem,
);

orderCorrectionRoutes.post(
  '/admin/order-corrections/:id/tickets/:ticketId/revert-rejected',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.revertRejectedTicket,
);

orderCorrectionRoutes.patch(
  '/admin/order-corrections/:id/total',
  authenticate,
  requireRole('SYSTEM_ADMIN'),
  orderCorrectionController.adjustOrderTotal,
);

export default orderCorrectionRoutes;
