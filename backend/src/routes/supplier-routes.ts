import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { supplierController } from '../controllers/supplier-controller';

const supplierRoutes = Router();

const bothRoles = requireRole('STORE_MANAGER', 'STORE_ATTENDANT');
const managerOnly = requireRole('STORE_MANAGER');

supplierRoutes.get('/suppliers', authenticate, branchScope, bothRoles, supplierController.list);
supplierRoutes.get('/suppliers/:id', authenticate, branchScope, bothRoles, supplierController.getById);
supplierRoutes.get(
  '/suppliers/:id/items',
  authenticate,
  branchScope,
  bothRoles,
  supplierController.getItems,
);

supplierRoutes.post('/suppliers', authenticate, branchScope, managerOnly, supplierController.create);
supplierRoutes.patch('/suppliers/:id', authenticate, branchScope, managerOnly, supplierController.update);
supplierRoutes.delete(
  '/suppliers/:id',
  authenticate,
  branchScope,
  managerOnly,
  supplierController.deactivate,
);

supplierRoutes.post(
  '/suppliers/:id/items',
  authenticate,
  branchScope,
  managerOnly,
  supplierController.assignItem,
);
supplierRoutes.delete(
  '/suppliers/:id/items/:itemId',
  authenticate,
  branchScope,
  managerOnly,
  supplierController.removeItem,
);

export default supplierRoutes;
