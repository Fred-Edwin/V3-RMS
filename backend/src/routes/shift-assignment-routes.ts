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
  requireRole('MANAGER', 'DIRECTOR', 'WAITER', 'CHEF', 'BARISTA'),
  shiftAssignmentController.listAssignments,
);

shiftAssignmentRoutes.post(
  '/shift-assignments',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  shiftAssignmentController.createAssignment,
);

shiftAssignmentRoutes.post(
  '/shift-assignments/batch',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  shiftAssignmentController.batchCreateAssignments,
);

shiftAssignmentRoutes.delete(
  '/shift-assignments/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  shiftAssignmentController.deleteAssignment,
);

export default shiftAssignmentRoutes;
