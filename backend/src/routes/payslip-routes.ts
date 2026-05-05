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
] as const;

payslipRoutes.post(
  '/payslips',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER'),
  payslipController.create,
);

payslipRoutes.get(
  '/payslips',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT'),
  payslipController.list,
);

// Must register literal sub-paths before /:id to avoid Express collisions.
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

payslipRoutes.patch(
  '/payslips/:id',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER'),
  payslipController.update,
);

payslipRoutes.post(
  '/payslips/:id/lock',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER'),
  payslipController.lock,
);

export default payslipRoutes;
