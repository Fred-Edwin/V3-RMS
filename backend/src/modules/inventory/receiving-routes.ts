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

// ── Receiving history ────────────────────────────────────────────────────
// Attendant-safe sibling of /inventory/purchasing/history above (2026-09-18
// amendment, receiving-validators.ts header) — STORE_ATTENDANT gets the same
// union rows with money/AP fields omitted (service-level canSeeMoney gate),
// not merely blocked at the route like the Purchasing-hub endpoint above.

router.get(
  '/inventory/receiving/history',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.getReceivingHistory,
);

// ── Expected deliveries ──────────────────────────────────────────────────
// STORE_ATTENDANT: read-only, response omits estimatedTotal (serializer-level).

router.get(
  '/inventory/expected-deliveries',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.listExpectedDeliveries,
);
router.get(
  '/inventory/expected-deliveries/:id',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.getExpectedDelivery,
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

// ── Goods receipts ───────────────────────────────────────────────────────
// STORE_MANAGER and STORE_ATTENDANT both have full access here (S4) — unlike
// the Supplier-AP endpoints S7 builds, where the Attendant is excluded
// (01-description.md Stage 10, plan §3.1).

router.get(
  '/inventory/goods-receipts',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  receivingController.listGoodsReceipts,
);
router.get(
  '/inventory/goods-receipts/:id',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  receivingController.getGoodsReceipt,
);
router.post(
  '/inventory/goods-receipts',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  receivingController.createGoodsReceipt,
);
router.patch(
  '/inventory/goods-receipts/:id',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  receivingController.updateGoodsReceipt,
);
router.post(
  '/inventory/goods-receipts/:id/sign',
  requireRole('STORE_MANAGER', 'STORE_ATTENDANT'),
  receivingController.signGoodsReceipt,
);

// ── What we owe (Supplier AP) — S7 ──────────────────────────────────────────
// STORE_ATTENDANT is deliberately absent from every route below — 403'd
// outright, not filtered (01-description.md Stage 10, plan §3.1, §22.3).

router.get(
  '/inventory/ap/summary',
  requireRole('STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.getApSummary,
);
router.get(
  '/inventory/ap/suppliers',
  requireRole('STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.listSupplierAp,
);
router.get(
  '/inventory/ap/suppliers/:id',
  requireRole('STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'),
  receivingController.getSupplierApDetail,
);
router.post(
  '/inventory/supplier-invoices',
  requireRole('STORE_MANAGER'),
  receivingController.createSupplierInvoice,
);
router.post(
  '/inventory/supplier-invoices/:id/adjustments',
  requireRole('STORE_MANAGER', 'ACCOUNTANT'),
  receivingController.createInvoiceAdjustment,
);
router.post(
  '/inventory/supplier-payments',
  requireRole('STORE_MANAGER', 'ACCOUNTANT'),
  receivingController.createSupplierPayment,
);
router.post(
  '/inventory/supplier-payments/:id/reverse',
  requireRole('STORE_MANAGER', 'ACCOUNTANT'),
  receivingController.reverseSupplierPayment,
);

export default router;
