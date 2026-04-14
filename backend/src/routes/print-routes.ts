import { Router } from 'express';
import { printController } from '../controllers/print-controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';
import { authenticatePrintStation } from '../middleware/print-station-auth';

const printRoutes = Router();

// ── Print Jobs (JWT auth, branch staff) ──────────────────────────────────────

// IMPORTANT: /print-jobs/other-income must be registered BEFORE /print-jobs/:id
printRoutes.post(
  '/print-jobs/other-income',
  authenticate,
  requireRole('WAITER', 'MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT'),
  printController.createOtherIncomePrintJob,
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

printRoutes.get(
  '/print-stations',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  printController.listPrintStations,
);

printRoutes.delete(
  '/print-stations/:id',
  authenticate,
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  printController.deactivatePrintStation,
);

export default printRoutes;
