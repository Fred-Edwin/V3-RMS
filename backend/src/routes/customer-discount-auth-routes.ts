import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { customerDiscountAuthController } from '../controllers/customer-discount-auth-controller';

const customerDiscountAuthRoutes = Router();

// List pending customer discount auth requests for the branch
customerDiscountAuthRoutes.get(
  '/customer-discount-auth',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  customerDiscountAuthController.listPending,
);

// Fetch a specific customer discount auth request
customerDiscountAuthRoutes.get(
  '/customer-discount-auth/:authRequestId',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER', 'CHEF', 'BARISTA', 'ACCOUNTANT'),
  customerDiscountAuthController.getById,
);

// Fetch the pending customer discount request for a specific order
customerDiscountAuthRoutes.get(
  '/orders/:orderId/customer-discount-auth',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER', 'CHEF', 'BARISTA'),
  customerDiscountAuthController.getPendingByOrderId,
);

// Manager/director approve or reject a customer discount request
customerDiscountAuthRoutes.post(
  '/customer-discount-auth/:authRequestId/override',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  customerDiscountAuthController.override,
);

export default customerDiscountAuthRoutes;
