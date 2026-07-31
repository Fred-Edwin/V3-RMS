import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { purchaseOrderController } from '../controllers/purchase-order-controller';

const purchaseOrderRoutes = Router();

const bothRoles = requireRole('STORE_MANAGER', 'STORE_ATTENDANT');
const managerOnly = requireRole('STORE_MANAGER');

purchaseOrderRoutes.get(
  '/purchase-orders/suggest',
  authenticate,
  branchScope,
  bothRoles,
  purchaseOrderController.suggestOrder,
);

purchaseOrderRoutes.get(
  '/purchase-orders',
  authenticate,
  branchScope,
  bothRoles,
  purchaseOrderController.list,
);

purchaseOrderRoutes.get(
  '/purchase-orders/:id',
  authenticate,
  branchScope,
  bothRoles,
  purchaseOrderController.getById,
);

purchaseOrderRoutes.post(
  '/purchase-orders',
  authenticate,
  branchScope,
  bothRoles,
  purchaseOrderController.create,
);

purchaseOrderRoutes.patch(
  '/purchase-orders/:id/lines',
  authenticate,
  branchScope,
  managerOnly,
  purchaseOrderController.updateLines,
);

purchaseOrderRoutes.post(
  '/purchase-orders/:id/send',
  authenticate,
  branchScope,
  managerOnly,
  purchaseOrderController.send,
);

purchaseOrderRoutes.post(
  '/purchase-orders/:id/unsend',
  authenticate,
  branchScope,
  managerOnly,
  purchaseOrderController.unsend,
);

purchaseOrderRoutes.post(
  '/purchase-orders/:id/cancel',
  authenticate,
  branchScope,
  managerOnly,
  purchaseOrderController.cancel,
);

purchaseOrderRoutes.post(
  '/purchase-orders/:id/lines/:lineId/receive',
  authenticate,
  branchScope,
  bothRoles,
  purchaseOrderController.receiveLine,
);

purchaseOrderRoutes.post(
  '/purchase-orders/:id/lines/:lineId/reverse-receipt',
  authenticate,
  branchScope,
  managerOnly,
  purchaseOrderController.reverseLineReceipt,
);

export default purchaseOrderRoutes;
