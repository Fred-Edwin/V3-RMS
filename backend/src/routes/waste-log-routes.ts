import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { wasteLogController } from '../controllers/waste-log-controller';

const wasteLogRoutes = Router();

const bothRoles = requireRole('STORE_MANAGER', 'STORE_ATTENDANT');

/** List — Manager sees all entries; Attendant sees only their own (service-layer filter). */
wasteLogRoutes.get(
  '/waste-logs',
  authenticate,
  branchScope,
  bothRoles,
  wasteLogController.list,
);

wasteLogRoutes.get(
  '/waste-logs/:id',
  authenticate,
  branchScope,
  bothRoles,
  wasteLogController.getById,
);

/** 3-tap entry — both roles (§8.3). */
wasteLogRoutes.post(
  '/waste-logs',
  authenticate,
  branchScope,
  bothRoles,
  wasteLogController.create,
);

export default wasteLogRoutes;
