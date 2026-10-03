import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireRole } from '../../../middleware/rbac';
import { allowDepartmentHead } from '../../../middleware/allow-department-head';
import { stockController } from './stock-controller';

const router = Router();

router.use(authenticate);

// ── Stock position & ledger (Milestone Six, Session 1) ──────────────────────
// Blind count (plan §7 Q-A): STORE_ATTENDANT is admitted to the summary
// only, where the service answers with the `{todaysCount}`-only schema. The
// list and the ledger exclude the attendant at the route (403).
// Literal `/inventory/stock/summary` registers before the param route.

router.get('/inventory/stock', requireRole('STORE_MANAGER'), stockController.listStock);
router.get(
  '/inventory/stock/summary',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  stockController.getSummary,
);
router.get(
  '/inventory/stock/items/:itemId/ledger',
  allowDepartmentHead(requireRole('STORE_MANAGER', 'MANAGER')),
  stockController.getLedger,
);

export default router;
