import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { stockCountController } from '../controllers/stock-count-controller';

const stockCountRoutes = Router();

const bothRoles = requireRole('STORE_MANAGER', 'STORE_ATTENDANT');
const managerOnly = requireRole('STORE_MANAGER');

stockCountRoutes.get(
  '/stock-counts',
  authenticate,
  branchScope,
  bothRoles,
  stockCountController.list,
);

stockCountRoutes.get(
  '/stock-counts/:id',
  authenticate,
  branchScope,
  bothRoles,
  stockCountController.getById,
);

/** Session creation — Manager-only (§8.3). */
stockCountRoutes.post(
  '/stock-counts',
  authenticate,
  branchScope,
  managerOnly,
  stockCountController.create,
);

/** Execute/submit — both roles (§8.3). D-14: response for an Attendant caller omits expectedQty/gapQty. */
stockCountRoutes.post(
  '/stock-counts/:id/submit',
  authenticate,
  branchScope,
  bothRoles,
  stockCountController.submit,
);

/** Approve, posts adjustment transactions — Manager-only (§8.3). */
stockCountRoutes.post(
  '/stock-counts/:id/approve',
  authenticate,
  branchScope,
  managerOnly,
  stockCountController.approve,
);

export default stockCountRoutes;
