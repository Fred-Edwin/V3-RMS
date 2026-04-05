import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { customerCreditController } from '../controllers/customer-credit-controller';

const customerCreditRoutes = Router();

customerCreditRoutes.get(
  '/customer-credit-accounts',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'WAITER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  customerCreditController.list,
);

// WAITER can create inline during payment
customerCreditRoutes.post(
  '/customer-credit-accounts',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'WAITER'),
  customerCreditController.createAccount,
);

customerCreditRoutes.patch(
  '/customer-credit-accounts/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'SYSTEM_ADMIN'),
  customerCreditController.updateAccount,
);

customerCreditRoutes.get(
  '/customer-credit-accounts/:id/orders',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  customerCreditController.getOrderHistory,
);

customerCreditRoutes.post(
  '/customer-credit-accounts/:id/settlements',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  customerCreditController.recordSettlement,
);

export default customerCreditRoutes;
