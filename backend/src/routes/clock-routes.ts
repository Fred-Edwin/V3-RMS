import { Router } from 'express';
import { clockController } from '../controllers/clock-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';
import { refuseLegacyClockWhenSwitched } from '../modules/workforce';

const clockRoutes = Router();

// Workforce slice 3: for a site whose new clock is switched on, these four answer a refusal (409) and change nothing.
// For every other site the guard does nothing and the legacy clock behaves exactly as before.
clockRoutes.post(
  '/clock/in',
  authenticate,
  branchScope,
  requireRole('WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'),
  refuseLegacyClockWhenSwitched,
  clockController.clockIn,
);

clockRoutes.post(
  '/clock/out',
  authenticate,
  branchScope,
  requireRole('WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'),
  refuseLegacyClockWhenSwitched,
  clockController.clockOut,
);

clockRoutes.post(
  '/clock/undo-out',
  authenticate,
  branchScope,
  requireRole('WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING'),
  refuseLegacyClockWhenSwitched,
  clockController.undoClockOut,
);

clockRoutes.post(
  '/clock/override',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  refuseLegacyClockWhenSwitched,
  clockController.clockOverride,
);

export default clockRoutes;
