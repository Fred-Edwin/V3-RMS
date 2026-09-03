import { Router } from 'express';
import { shiftAssignmentController } from '../controllers/shift-assignment-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { allowDepartmentHead } from '../middleware/allow-department-head';

const shiftAssignmentRoutes = Router();

shiftAssignmentRoutes.get(
  '/shift-assignments',
  authenticate,
  branchScope,
  allowDepartmentHead(
    requireRole('MANAGER', 'DIRECTOR', 'HR_MANAGER', 'WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'),
  ),
  shiftAssignmentController.listAssignments,
);

shiftAssignmentRoutes.post(
  '/shift-assignments',
  authenticate,
  branchScope,
  allowDepartmentHead(requireRole('MANAGER', 'HR_MANAGER')),
  shiftAssignmentController.createAssignment,
);

shiftAssignmentRoutes.post(
  '/shift-assignments/batch',
  authenticate,
  branchScope,
  allowDepartmentHead(requireRole('MANAGER', 'HR_MANAGER')),
  shiftAssignmentController.batchCreateAssignments,
);

shiftAssignmentRoutes.post(
  '/shift-assignments/copy-week',
  authenticate,
  branchScope,
  allowDepartmentHead(requireRole('MANAGER', 'HR_MANAGER')),
  shiftAssignmentController.copyWeek,
);

shiftAssignmentRoutes.post(
  '/shift-assignments/batch-delete',
  authenticate,
  branchScope,
  allowDepartmentHead(requireRole('MANAGER', 'HR_MANAGER')),
  shiftAssignmentController.batchDeleteAssignments,
);

shiftAssignmentRoutes.post(
  '/shift-assignments/reconcile-week',
  authenticate,
  branchScope,
  allowDepartmentHead(requireRole('MANAGER', 'HR_MANAGER')),
  shiftAssignmentController.reconcileWeek,
);

shiftAssignmentRoutes.delete(
  '/shift-assignments/:id',
  authenticate,
  branchScope,
  allowDepartmentHead(requireRole('MANAGER', 'HR_MANAGER')),
  shiftAssignmentController.deleteAssignment,
);

export default shiftAssignmentRoutes;
