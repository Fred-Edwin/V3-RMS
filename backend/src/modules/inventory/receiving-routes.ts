import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { receivingController } from './receiving-controller';

const router = Router();

router.use(authenticate);

// ── Purchasing hub ───────────────────────────────────────────────────────
// STORE_ATTENDANT has zero access — not even read (01-description.md Stage 10, plan §3.1).

router.get(
  '/inventory/purchasing/summary',
  requireRole('STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.getPurchasingSummary,
);
router.get(
  '/inventory/purchasing/history',
  requireRole('STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.getPurchasingHistory,
);

// ── Expected deliveries ──────────────────────────────────────────────────
// STORE_ATTENDANT: read-only, response omits estimatedTotal (serializer-level).

router.get(
  '/inventory/expected-deliveries',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.listExpectedDeliveries,
);
router.post(
  '/inventory/expected-deliveries',
  requireRole('STORE_MANAGER'),
  receivingController.createExpectedDelivery,
);
router.post(
  '/inventory/expected-deliveries/:id/cancel',
  requireRole('STORE_MANAGER'),
  receivingController.cancelExpectedDelivery,
);

// ── Items ────────────────────────────────────────────────────────────────

router.get(
  '/inventory/items/:id/last-price',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.getLastPrice,
);

// ── Suppliers ─────────────────────────────────────────────────────────────
// New-purchase builder only — same audience as expected-deliveries create.

router.get(
  '/inventory/suppliers/:id/recent-items',
  requireRole('STORE_MANAGER'),
  receivingController.getRecentSupplierItems,
);

export default router;
