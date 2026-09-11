import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { orderCorrectionController } from '../controllers/order-correction-controller';

const orderCorrectionRoutes = Router();

// SYSTEM_ADMIN has unrestricted, cross-branch access with no correction-age limit.
// MANAGER/DIRECTOR are branch-scoped (enforced in order-correction-service.ts —
// assertOrderInScope) and limited to a 90-day correction window instead of SYSTEM_ADMIN's
// unbounded one. Literal sub-paths registered before parameterised /:id to avoid Express
// collisions.
const correctionRoles = ['SYSTEM_ADMIN', 'MANAGER', 'DIRECTOR'] as const;

orderCorrectionRoutes.get(
  '/admin/order-corrections',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.listOrders,
);

orderCorrectionRoutes.get(
  '/admin/order-corrections/:id',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.getOrderDetail,
);

orderCorrectionRoutes.get(
  '/admin/order-corrections/:id/audit-log',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.getAuditLog,
);

orderCorrectionRoutes.patch(
  '/admin/order-corrections/:id/mpesa-code',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.correctMpesaCode,
);

orderCorrectionRoutes.patch(
  '/admin/order-corrections/:id/payment-method',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.correctPaymentMethod,
);

orderCorrectionRoutes.post(
  '/admin/order-corrections/:id/force-ready',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.forceOrderReady,
);

orderCorrectionRoutes.post(
  '/admin/order-corrections/:id/revert-auth',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.revertAwaitingAuth,
);

orderCorrectionRoutes.patch(
  '/admin/order-corrections/:id/items/:itemId/remove',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.removeOrderItem,
);

orderCorrectionRoutes.post(
  '/admin/order-corrections/:id/tickets/:ticketId/revert-rejected',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.revertRejectedTicket,
);

orderCorrectionRoutes.patch(
  '/admin/order-corrections/:id/total',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.adjustOrderTotal,
);

orderCorrectionRoutes.post(
  '/admin/order-corrections/:id/split-lines',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.addSplitLine,
);

orderCorrectionRoutes.delete(
  '/admin/order-corrections/:id/split-lines/:lineId',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.removeSplitLine,
);

orderCorrectionRoutes.post(
  '/admin/order-corrections/:id/convert-to-split',
  authenticate,
  requireRole(...correctionRoles),
  orderCorrectionController.convertToSplit,
);

export default orderCorrectionRoutes;
