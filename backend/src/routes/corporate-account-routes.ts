import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { corporateAccountController } from '../controllers/corporate-account-controller';

const corporateAccountRoutes = Router();

// GET is accessible to WAITER and MANAGER for the payment dropdown (returns minimal data)
// Full details returned for DIRECTOR and SYSTEM_ADMIN
corporateAccountRoutes.get(
  '/corporate-accounts',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'WAITER', 'ACCOUNTANT'),
  corporateAccountController.list,
);

corporateAccountRoutes.post(
  '/corporate-accounts',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  corporateAccountController.createAccount,
);

corporateAccountRoutes.patch(
  '/corporate-accounts/:id',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR'),
  corporateAccountController.updateAccount,
);

corporateAccountRoutes.get(
  '/corporate-accounts/:id/orders',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT'),
  corporateAccountController.getOrderHistory,
);

corporateAccountRoutes.get(
  '/corporate-accounts/:id/settlements',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT'),
  corporateAccountController.getSettlementHistory,
);

corporateAccountRoutes.post(
  '/corporate-accounts/:id/settlements',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'ACCOUNTANT'),
  corporateAccountController.recordSettlement,
);

export default corporateAccountRoutes;
