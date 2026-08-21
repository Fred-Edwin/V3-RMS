import { Router } from 'express';
import { departmentController } from '../controllers/department-controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';

const departmentRoutes = Router();

const canManageDepartments = requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN');

departmentRoutes.get(
  '/branches/:orgId/departments',
  authenticate,
  canManageDepartments,
  departmentController.listDepartments,
);

departmentRoutes.get(
  '/branches/:orgId/departments/:tag/eligible-staff',
  authenticate,
  canManageDepartments,
  departmentController.listEligibleStaff,
);

departmentRoutes.patch(
  '/branches/:orgId/departments/:tag/head',
  authenticate,
  canManageDepartments,
  departmentController.assignHead,
);

departmentRoutes.delete(
  '/branches/:orgId/departments/:tag/head',
  authenticate,
  canManageDepartments,
  departmentController.unassignHead,
);

export default departmentRoutes;
