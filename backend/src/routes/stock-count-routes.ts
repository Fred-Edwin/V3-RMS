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

/** Session creation — both roles can create a session at any time; only Manager approves it. */
stockCountRoutes.post(
  '/stock-counts',
  authenticate,
  branchScope,
  bothRoles,
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

/**
 * Correct counted quantities on a SUBMITTED session before approving —
 * Manager-only. Added 2026-07-30 so a miscounted line can be fixed instead
 * of forcing an approve-as-is or no action at all.
 */
stockCountRoutes.patch(
  '/stock-counts/:id/lines',
  authenticate,
  branchScope,
  managerOnly,
  stockCountController.correctLines,
);

export default stockCountRoutes;
