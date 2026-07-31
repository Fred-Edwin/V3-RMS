import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { inventoryReportController } from '../controllers/inventory-report-controller';

const inventoryReportRoutes = Router();

/** Reports — Manager-only, no "both roles" tier (§8.3: "Reports ... | ✅ | ❌"). */
const managerOnly = requireRole('STORE_MANAGER');

inventoryReportRoutes.get(
  '/inventory-reports/stock-valuation',
  authenticate,
  branchScope,
  managerOnly,
  inventoryReportController.getStockValuation,
);

inventoryReportRoutes.get(
  '/inventory-reports/low-stock-alerts',
  authenticate,
  branchScope,
  managerOnly,
  inventoryReportController.getLowStockAlerts,
);

inventoryReportRoutes.get(
  '/inventory-reports/price-history',
  authenticate,
  branchScope,
  managerOnly,
  inventoryReportController.getPriceHistory,
);

inventoryReportRoutes.get(
  '/inventory-reports/prep-yield',
  authenticate,
  branchScope,
  managerOnly,
  inventoryReportController.getPrepYield,
);

inventoryReportRoutes.get(
  '/inventory-reports/count-discrepancy',
  authenticate,
  branchScope,
  managerOnly,
  inventoryReportController.getCountDiscrepancy,
);

inventoryReportRoutes.get(
  '/inventory-reports/prepped-item-cost',
  authenticate,
  branchScope,
  managerOnly,
  inventoryReportController.getTrueCostPerPreppedItem,
);

inventoryReportRoutes.get(
  '/inventory-reports/supplier-ap-aging',
  authenticate,
  branchScope,
  managerOnly,
  inventoryReportController.getSupplierApAging,
);

export default inventoryReportRoutes;
