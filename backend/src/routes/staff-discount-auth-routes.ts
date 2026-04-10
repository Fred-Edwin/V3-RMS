import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { staffDiscountAuthController } from '../controllers/staff-discount-auth-controller';

const staffDiscountAuthRoutes = Router();

// List all pending discount auth requests for the branch — manager/director only
staffDiscountAuthRoutes.get(
  '/staff-discount-auth',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  staffDiscountAuthController.listPending,
);

// Fetch a specific discount auth request by ID
staffDiscountAuthRoutes.get(
  '/staff-discount-auth/:authRequestId',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER', 'CHEF', 'BARISTA', 'ACCOUNTANT'),
  staffDiscountAuthController.getById,
);

// Fetch the pending discount auth request for a specific order
staffDiscountAuthRoutes.get(
  '/orders/:orderId/staff-discount-auth',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER', 'CHEF', 'BARISTA'),
  staffDiscountAuthController.getPendingByOrderId,
);

// Manager/director approve or reject a discount request
staffDiscountAuthRoutes.post(
  '/staff-discount-auth/:authRequestId/override',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  staffDiscountAuthController.override,
);

export default staffDiscountAuthRoutes;
