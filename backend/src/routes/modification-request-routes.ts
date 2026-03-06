import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { modificationRequestController } from '../controllers/modification-request-controller';

const modificationRequestRoutes = Router();

modificationRequestRoutes.post(
  '/orders/:orderId/modification-requests',
  authenticate,
  branchScope,
  requireRole('WAITER'),
  modificationRequestController.create,
);

modificationRequestRoutes.get(
  '/orders/:orderId/modification-requests',
  authenticate,
  branchScope,
  requireRole('WAITER', 'CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'MANAGER'),
  modificationRequestController.getByOrder,
);

modificationRequestRoutes.patch(
  '/modification-requests/:id/review',
  authenticate,
  branchScope,
  requireRole('CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'),
  modificationRequestController.review,
);

export default modificationRequestRoutes;
