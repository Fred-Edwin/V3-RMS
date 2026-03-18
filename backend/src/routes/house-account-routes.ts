import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { houseAccountController } from '../controllers/house-account-controller';

const houseAccountRoutes = Router();

// IMPORTANT: literal sub-paths must be registered BEFORE /:id to prevent
// Express matching literal strings as UUID params.
houseAccountRoutes.get(
  '/house-accounts/active',
  authenticate,
  requireRole('MANAGER', 'WAITER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  houseAccountController.listActive,
);

houseAccountRoutes.get(
  '/house-accounts/my',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  houseAccountController.getOwn,
);

houseAccountRoutes.get(
  '/house-accounts',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  houseAccountController.list,
);

houseAccountRoutes.post(
  '/house-accounts',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  houseAccountController.grantAccount,
);

houseAccountRoutes.patch(
  '/house-accounts/:id',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  houseAccountController.updateAccount,
);

houseAccountRoutes.get(
  '/house-accounts/:id/orders',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  houseAccountController.getOrderHistory,
);

houseAccountRoutes.post(
  '/house-accounts/:id/settlements',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER'),
  houseAccountController.recordSettlement,
);

export default houseAccountRoutes;
