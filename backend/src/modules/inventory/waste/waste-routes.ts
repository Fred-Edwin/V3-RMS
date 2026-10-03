import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireRole } from '../../../middleware/rbac';
import { allowDepartmentHead } from '../../../middleware/allow-department-head';
import { wasteController } from './waste-controller';

const router = Router();

router.use(authenticate);

// ── Waste (Milestone Six, Session 1) ────────────────────────────────────────
// Location is resolved from the actor in the service; the Branch Manager is
// not a waste role this milestone (the branch shell's "Waste" nav stays a
// placeholder — plan Context).

router.get(
  '/inventory/waste/items',
  allowDepartmentHead(requireRole('STORE_MANAGER', 'STORE_ATTENDANT')),
  wasteController.listItemOptions,
);
router.get(
  '/inventory/waste',
  allowDepartmentHead(requireRole('STORE_MANAGER', 'STORE_ATTENDANT')),
  wasteController.listWaste,
);
router.post(
  '/inventory/waste',
  allowDepartmentHead(requireRole('STORE_MANAGER', 'STORE_ATTENDANT')),
  wasteController.createWaste,
);

export default router;
