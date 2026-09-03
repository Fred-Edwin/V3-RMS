import { Router } from 'express';
import { shiftController } from '../controllers/shift-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { allowDepartmentHead } from '../middleware/allow-department-head';

const shiftRoutes = Router();

shiftRoutes.get(
  '/shifts',
  authenticate,
  branchScope,
  // A department head reads the shift list to render its department schedule grid;
  // it cannot create/edit/delete shift definitions (those stay MANAGER/HR_MANAGER).
  allowDepartmentHead(requireRole('MANAGER', 'DIRECTOR', 'HR_MANAGER')),
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
