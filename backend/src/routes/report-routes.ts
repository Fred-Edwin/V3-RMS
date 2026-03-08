import { Router } from 'express';
import { reportController } from '../controllers/report-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const reportRoutes = Router();

reportRoutes.get(
  '/reports/daily-summary',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR'),
  reportController.getDailySummary,
);

reportRoutes.get(
  '/reports/staff-performance',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR'),
  reportController.getStaffPerformance,
);

reportRoutes.get(
  '/reports/branch-overview',
  authenticate,
  requireRole('DIRECTOR'),
  reportController.getBranchOverview,
);

reportRoutes.get(
  '/reports/branch-trends',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR'),
  reportController.getBranchTrends,
);

reportRoutes.get(
  '/reports/director-trends',
  authenticate,
  requireRole('DIRECTOR'),
  reportController.getDirectorTrends,
);

reportRoutes.get(
  '/reports/director-pulse',
  authenticate,
  requireRole('DIRECTOR'),
  reportController.getDirectorPulse,
);

reportRoutes.get(
  '/reports/my-performance',
  authenticate,
  branchScope,
  requireRole('WAITER', 'CHEF', 'BARISTA'),
  reportController.getMyPerformance,
);

reportRoutes.get(
  '/reports/export',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR'),
  reportController.exportReport,
);

export default reportRoutes;

