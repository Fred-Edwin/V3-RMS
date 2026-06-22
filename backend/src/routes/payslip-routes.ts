import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { payslipController } from '../controllers/payslip-controller';

const payslipRoutes = Router();

const ALL_HUMAN_ROLES = [
  'SYSTEM_ADMIN',
  'DIRECTOR',
  'HR_MANAGER',
  'MANAGER',
  'ACCOUNTANT',
  'WAITER',
  'CHEF',
  'BARISTA',
  'STEWARD',
  'HOUSEKEEPING',
] as const;

// Must register literal sub-paths before /:id to avoid Express collisions.
payslipRoutes.post(
  '/payslips/bulk-upsert',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER'),
  payslipController.bulkUpsert,
);

payslipRoutes.post(
  '/payslips/publish',
  authenticate,
  requireRole('DIRECTOR', 'HR_MANAGER'),
  payslipController.publish,
);

payslipRoutes.post(
  '/payslips/revert',
  authenticate,
  requireRole('DIRECTOR', 'HR_MANAGER'),
  payslipController.revert,
);

payslipRoutes.get(
  '/payslips',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER', 'MANAGER'),
  payslipController.list,
);

payslipRoutes.get(
  '/payslips/my',
  authenticate,
  requireRole(...ALL_HUMAN_ROLES),
  payslipController.listMine,
);

payslipRoutes.get(
  '/payslips/branch/:branchId',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER', 'MANAGER'),
  payslipController.listByBranch,
);

payslipRoutes.get(
  '/payslips/:id',
  authenticate,
  requireRole(...ALL_HUMAN_ROLES),
  payslipController.getById,
);

export default payslipRoutes;
