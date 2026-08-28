import { Router } from 'express';
import { marketPurchaseOrderController } from '../controllers/market-purchase-order-controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';

const marketPurchaseOrderRoutes = Router();

const canRequest = requireRole('DEPARTMENT_HEAD');
const canManage = requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN');
const canView = requireRole('DEPARTMENT_HEAD', 'MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN');

marketPurchaseOrderRoutes.get('/market-purchase-orders', authenticate, canView, marketPurchaseOrderController.list);
marketPurchaseOrderRoutes.get(
  '/market-purchase-orders/:id',
  authenticate,
  canView,
  marketPurchaseOrderController.getById,
);
marketPurchaseOrderRoutes.get(
  '/market-purchase-orders/:id/my-department',
  authenticate,
  canRequest,
  marketPurchaseOrderController.getForDepartment,
);
marketPurchaseOrderRoutes.post(
  '/market-purchase-orders/request-items',
  authenticate,
  canRequest,
  marketPurchaseOrderController.requestItems,
);
marketPurchaseOrderRoutes.patch(
  '/market-purchase-orders/:id/lines',
  authenticate,
  canManage,
  marketPurchaseOrderController.editDraftLines,
);
marketPurchaseOrderRoutes.delete(
  '/market-purchase-orders/:id/lines/:lineId',
  authenticate,
  canManage,
  marketPurchaseOrderController.removeDraftLine,
);
marketPurchaseOrderRoutes.patch(
  '/market-purchase-orders/:id/discard',
  authenticate,
  canManage,
  marketPurchaseOrderController.discardDraft,
);
marketPurchaseOrderRoutes.patch(
  '/market-purchase-orders/:id/approve',
  authenticate,
  canManage,
  marketPurchaseOrderController.approve,
);
marketPurchaseOrderRoutes.patch(
  '/market-purchase-orders/:id/send-to-market',
  authenticate,
  canManage,
  marketPurchaseOrderController.sendToMarket,
);
marketPurchaseOrderRoutes.patch(
  '/market-purchase-orders/:id/reconcile',
  authenticate,
  canManage,
  marketPurchaseOrderController.reconcileLines,
);
marketPurchaseOrderRoutes.patch(
  '/market-purchase-orders/:id/complete',
  authenticate,
  canManage,
  marketPurchaseOrderController.complete,
);
marketPurchaseOrderRoutes.patch(
  '/market-purchase-orders/:id/receive',
  authenticate,
  canRequest,
  marketPurchaseOrderController.confirmReceived,
);
marketPurchaseOrderRoutes.patch(
  '/market-purchase-orders/:id/reject',
  authenticate,
  canManage,
  marketPurchaseOrderController.reject,
);

export default marketPurchaseOrderRoutes;
