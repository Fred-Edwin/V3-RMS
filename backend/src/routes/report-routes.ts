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
  requireRole('MANAGER', 'DIRECTOR', 'ACCOUNTANT'),
  reportController.getDailySummary,
);

reportRoutes.get(
  '/reports/staff-performance',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR', 'ACCOUNTANT'),
  reportController.getStaffPerformance,
);

reportRoutes.get(
  '/reports/branch-overview',
  authenticate,
  requireRole('DIRECTOR', 'ACCOUNTANT'),
  reportController.getBranchOverview,
);

reportRoutes.get(
  '/reports/branch-trends',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR', 'ACCOUNTANT'),
  reportController.getBranchTrends,
);

reportRoutes.get(
  '/reports/director-trends',
  authenticate,
  requireRole('DIRECTOR', 'ACCOUNTANT'),
  reportController.getDirectorTrends,
);

reportRoutes.get(
  '/reports/director-pulse',
  authenticate,
  requireRole('DIRECTOR', 'ACCOUNTANT'),
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
  requireRole('MANAGER', 'DIRECTOR', 'ACCOUNTANT'),
  reportController.exportReport,
);

reportRoutes.get(
  '/reports/outstanding-balances',
  authenticate,
  requireRole('SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'ACCOUNTANT'),
  reportController.getOutstandingBalances,
);

reportRoutes.get(
  '/reports/hourly-heatmap',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR', 'ACCOUNTANT'),
  reportController.getHourlyHeatmap,
);

reportRoutes.get(
  '/reports/items-performance',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'DIRECTOR', 'ACCOUNTANT'),
  reportController.getItemsPerformance,
);

reportRoutes.get(
  '/reports/accountant-reconciliation',
  authenticate,
  requireRole('ACCOUNTANT', 'SYSTEM_ADMIN'),
  reportController.getAccountantReconciliation,
);

export default reportRoutes;

