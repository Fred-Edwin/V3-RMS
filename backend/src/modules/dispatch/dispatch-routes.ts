import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
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

export default router;
