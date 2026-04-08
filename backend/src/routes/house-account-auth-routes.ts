import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { houseAccountAuthController } from '../controllers/house-account-auth-controller';

const houseAccountAuthRoutes = Router();

// List all pending auth requests for the branch — manager/director only
houseAccountAuthRoutes.get(
  '/house-auth',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  houseAccountAuthController.listPending,
);

// Fetch a specific auth request by ID — account holder or manager
houseAccountAuthRoutes.get(
  '/house-auth/:authRequestId',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER'),
  houseAccountAuthController.getById,
);

// Fetch the pending auth request for an order — waiter or manager
houseAccountAuthRoutes.get(
  '/orders/:orderId/house-auth',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'WAITER'),
  houseAccountAuthController.getPendingByOrderId,
);

// Account holder resolves (approve/reject)
houseAccountAuthRoutes.post(
  '/house-auth/:authRequestId/resolve',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  houseAccountAuthController.resolve,
);

// Manager/director force-expire a stuck expired request
houseAccountAuthRoutes.post(
  '/house-auth/:authRequestId/force-expire',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  houseAccountAuthController.forceExpire,
);

// Manager/director override
houseAccountAuthRoutes.post(
  '/house-auth/:authRequestId/override',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR'),
  houseAccountAuthController.override,
);

export default houseAccountAuthRoutes;
