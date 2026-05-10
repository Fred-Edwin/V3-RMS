import { Router } from 'express';
import { shiftController } from '../controllers/shift-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const shiftRoutes = Router();

shiftRoutes.get(
  '/shifts',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR', 'HR_MANAGER'),
  shiftController.listShifts,
);

shiftRoutes.post(
  '/shifts',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER'),
  shiftController.createShift,
);

shiftRoutes.patch(
  '/shifts/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER'),
  shiftController.updateShift,
);

shiftRoutes.delete(
  '/shifts/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER'),
  shiftController.deleteShift,
);

export default shiftRoutes;
