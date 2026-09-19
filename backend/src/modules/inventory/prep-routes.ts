import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { prepController } from './prep-controller';

const router = Router();

router.use(authenticate);

// ── Prep runs (Milestone Three) ─────────────────────────────────────────────
// No role-based response narrowing — unlike Receiving/AP, STORE_MANAGER and
// STORE_ATTENDANT both see identical Prep data including cost figures
// (confirmed against the approved Paper screens: unit cost shown on both
// roles' views). Plan §3.1.

router.get(
  '/inventory/prep/runs',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  prepController.listPrepRuns,
);
router.get(
  '/inventory/prep/runs/:id',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  prepController.getPrepRun,
);
router.post(
  '/inventory/prep/runs',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  prepController.createPrepRun,
);
router.get(
  '/inventory/prep/summary',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  prepController.getPrepSummary,
);
router.get(
  '/inventory/items/:id/typical-yield',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  prepController.getTypicalYield,
);

export default router;
