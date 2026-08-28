import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { staffDiscountAuthController } from '../controllers/staff-discount-auth-controller';

const staffDiscountAuthRoutes = Router();

// List all pending staff-discount auth requests system-wide — director only
staffDiscountAuthRoutes.get(
  '/staff-discount-auth',
  authenticate,
  requireRole('DIRECTOR'),
  staffDiscountAuthController.listPending,
);

// Fetch a specific discount auth request by ID (requester or director)
staffDiscountAuthRoutes.get(
  '/staff-discount-auth/:authRequestId',
  authenticate,
  requireRole('DIRECTOR', 'WAITER', 'CHEF', 'BARISTA', 'ACCOUNTANT'),
  staffDiscountAuthController.getById,
);

// Fetch the pending discount auth request for a specific order
staffDiscountAuthRoutes.get(
  '/orders/:orderId/staff-discount-auth',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER', 'CHEF', 'BARISTA'),
  staffDiscountAuthController.getPendingByOrderId,
);

// Director approves or rejects a staff-discount request
staffDiscountAuthRoutes.post(
  '/staff-discount-auth/:authRequestId/override',
  authenticate,
  requireRole('DIRECTOR'),
  staffDiscountAuthController.override,
);

// Requester withdraws their own pending staff-discount request
staffDiscountAuthRoutes.post(
  '/staff-discount-auth/:authRequestId/withdraw',
  authenticate,
  requireRole('WAITER', 'CHEF', 'BARISTA', 'MANAGER', 'DIRECTOR'),
  staffDiscountAuthController.withdraw,
);

export default staffDiscountAuthRoutes;
