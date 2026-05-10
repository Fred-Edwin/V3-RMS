import { Router } from 'express';
import { shiftAssignmentController } from '../controllers/shift-assignment-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const shiftAssignmentRoutes = Router();

shiftAssignmentRoutes.get(
  '/shift-assignments',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR', 'HR_MANAGER', 'WAITER', 'CHEF', 'BARISTA'),
  shiftAssignmentController.listAssignments,
);

shiftAssignmentRoutes.post(
  '/shift-assignments',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER'),
  shiftAssignmentController.createAssignment,
);

shiftAssignmentRoutes.post(
  '/shift-assignments/batch',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER'),
  shiftAssignmentController.batchCreateAssignments,
);

shiftAssignmentRoutes.post(
  '/shift-assignments/copy-week',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER'),
  shiftAssignmentController.copyWeek,
);

shiftAssignmentRoutes.post(
  '/shift-assignments/batch-delete',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER'),
  shiftAssignmentController.batchDeleteAssignments,
);

shiftAssignmentRoutes.post(
  '/shift-assignments/reconcile-week',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER'),
  shiftAssignmentController.reconcileWeek,
);

shiftAssignmentRoutes.delete(
  '/shift-assignments/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER'),
  shiftAssignmentController.deleteAssignment,
);

export default shiftAssignmentRoutes;
