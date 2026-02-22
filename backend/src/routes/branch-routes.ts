import { Router } from 'express';
import { branchController } from '../controllers/branch-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const branchRoutes = Router();

branchRoutes.get(
  '/branches',
  authenticate,
  branchScope,
  requireRole('DIRECTOR', 'SYSTEM_ADMIN'),
  branchController.list,
);
branchRoutes.post(
  '/branches',
  authenticate,
  branchScope,
  requireRole('SYSTEM_ADMIN'),
  branchController.create,
);
branchRoutes.patch(
  '/branches/:id',
  authenticate,
  branchScope,
  requireRole('SYSTEM_ADMIN'),
  branchController.update,
);
branchRoutes.patch(
  '/branches/:id/set-hub',
  authenticate,
  branchScope,
  requireRole('DIRECTOR', 'SYSTEM_ADMIN'),
  branchController.setHub,
);

export default branchRoutes;
