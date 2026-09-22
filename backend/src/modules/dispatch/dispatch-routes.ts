import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { allowDepartmentHead } from '../../middleware/allow-department-head';
import { dispatchController } from './dispatch-controller';

const router = Router();

router.use(authenticate);

// ── Dispatch (Milestone Five, Session A) — Central Store side ──────────────
// Store Manager / Store Attendant on the hub org. Mount order: literal
// `/dispatch/queue` must register before the `/dispatch/:id/...` param
// routes, same reasoning as requisitions-routes.ts.

router.get('/dispatch/queue', requireRole('STORE_MANAGER', 'STORE_ATTENDANT'), dispatchController.listQueue);
router.get(
  '/dispatch/:requisitionId/fulfil',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  dispatchController.getFulfilDetail,
);
router.post(
  '/dispatch/:requisitionId/fulfil/:departmentTag',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  dispatchController.fulfilDepartment,
);
router.get(
  '/dispatch/:id/delivery-note',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  dispatchController.getDeliveryNote,
);

// ── Deliveries (Milestone Five, Session B) — branch org side ───────────────
// Department Head sees only their own department (assertOwnDepartment-style
// check happens in the service, per session-b-plan.md decision #8); Branch
// Manager sees every department. Literal `/deliveries` must register before
// `/deliveries/:id` param routes, same reasoning as requisitions-routes.ts.

router.get('/deliveries', allowDepartmentHead(requireRole('MANAGER')), dispatchController.listDeliveries);
router.get('/deliveries/:id', allowDepartmentHead(requireRole('MANAGER')), dispatchController.getDeliveryDetail);
router.post(
  '/deliveries/:id/confirm',
  allowDepartmentHead(requireRole('MANAGER')),
  dispatchController.confirmDelivery,
);
router.post(
  '/deliveries/:id/confirm-on-behalf',
  requireRole('MANAGER'),
  dispatchController.confirmDeliveryOnBehalf,
);
router.get(
  '/deliveries/:id/delivery-note',
  allowDepartmentHead(requireRole('MANAGER')),
  dispatchController.getDeliveryNoteForBranch,
);

// ── Discrepancies (Milestone Five, Session B) ───────────────────────────────
// GET /discrepancies is one endpoint, two response shapes by role — Store
// Manager (hub) sees all branches, Branch Manager sees only their own branch,
// read-only. Resolve is Store Manager only. Literal `/discrepancies` must
// register before `/discrepancies/:id`.

router.get(
  '/discrepancies',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT', 'MANAGER'),
  dispatchController.listDiscrepancies,
);
router.get(
  '/discrepancies/:id',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT', 'MANAGER'),
  dispatchController.getDiscrepancy,
);
router.post('/discrepancies/:id/resolve', requireRole('STORE_MANAGER'), dispatchController.resolveDiscrepancy);

export default router;
