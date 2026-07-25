import { Router } from 'express';
import { printController } from '../controllers/print-controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { authenticatePrintStation } from '../middleware/print-station-auth';

const printRoutes = Router();

// ── Print Jobs (JWT auth, branch staff) ──────────────────────────────────────

// IMPORTANT: /print-jobs/other-income and /print-jobs/corporate-settlement must be registered BEFORE /print-jobs/:id
printRoutes.post(
  '/print-jobs/other-income',
  authenticate,
  requireRole('WAITER', 'MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  printController.createOtherIncomePrintJob,
);

// Only roles that can settle a corporate account (FR-CRD-02) may print its settlement receipt.
printRoutes.post(
  '/print-jobs/corporate-settlement',
  authenticate,
  requireRole('DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  printController.createCorporateSettlementPrintJob,
);

printRoutes.post(
  '/print-jobs',
  authenticate,
  requireRole('WAITER', 'MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  printController.createPrintJob,
);

printRoutes.get(
  '/print-jobs',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  printController.getPrintJobs,
);

printRoutes.get(
  '/print-jobs/:id',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  printController.getPrintJobById,
);

// ── Print Station Endpoints (print station token auth) ────────────────────────

printRoutes.get(
  '/print-station/jobs',
  authenticatePrintStation,
  printController.getStationJobs,
);

printRoutes.patch(
  '/print-station/jobs/:id',
  authenticatePrintStation,
  printController.updateStationJobStatus,
);

printRoutes.post(
  '/print-station/heartbeat',
  authenticatePrintStation,
  printController.heartbeat,
);

// ── Print Station Management (JWT auth, managers+) ────────────────────────────

printRoutes.post(
  '/print-stations',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  printController.createPrintStation,
);

// IMPORTANT: /print-stations/selectable must be registered BEFORE /print-stations/:id
// Waiters need this for the print-target picker; the management list below is manager-only.
printRoutes.get(
  '/print-stations/selectable',
  authenticate,
  requireRole('WAITER', 'MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  printController.listSelectablePrintStations,
);

printRoutes.get(
  '/print-stations',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  printController.listPrintStations,
);

// IMPORTANT: /print-stations/:id/test-print must be registered BEFORE /print-stations/:id
printRoutes.post(
  '/print-stations/:id/test-print',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  printController.testPrintStation,
);

printRoutes.delete(
  '/print-stations/:id',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  printController.deactivatePrintStation,
);

export default printRoutes;
