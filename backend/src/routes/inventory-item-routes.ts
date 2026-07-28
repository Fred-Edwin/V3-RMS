import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { inventoryItemController } from '../controllers/inventory-item-controller';

const inventoryItemRoutes = Router();

const bothRoles = requireRole('STORE_MANAGER', 'STORE_ATTENDANT');
const managerOnly = requireRole('STORE_MANAGER');

inventoryItemRoutes.get(
  '/inventory-items/low-stock',
  authenticate,
  branchScope,
  bothRoles,
  inventoryItemController.listLowStock,
);

inventoryItemRoutes.get(
  '/inventory-items',
  authenticate,
  branchScope,
  bothRoles,
  inventoryItemController.list,
);

inventoryItemRoutes.get(
  '/inventory-items/:id/transactions',
  authenticate,
  branchScope,
  bothRoles,
  inventoryItemController.getTransactions,
);

inventoryItemRoutes.get(
  '/inventory-items/:id',
  authenticate,
  branchScope,
  bothRoles,
  inventoryItemController.getById,
);

inventoryItemRoutes.post(
  '/inventory-items',
  authenticate,
  branchScope,
  managerOnly,
  inventoryItemController.create,
);

inventoryItemRoutes.patch(
  '/inventory-items/:id',
  authenticate,
  branchScope,
  managerOnly,
  inventoryItemController.update,
);

inventoryItemRoutes.delete(
  '/inventory-items/:id',
  authenticate,
  branchScope,
  managerOnly,
  inventoryItemController.deactivate,
);

export default inventoryItemRoutes;
