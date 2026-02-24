import { Router } from 'express';
import { clockController } from '../controllers/clock-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const clockRoutes = Router();

clockRoutes.post(
  '/clock/in',
  authenticate,
  branchScope,
  requireRole('WAITER', 'CHEF', 'BARISTA'),
  clockController.clockIn,
);

clockRoutes.post(
  '/clock/out',
  authenticate,
  branchScope,
  requireRole('WAITER', 'CHEF', 'BARISTA'),
  clockController.clockOut,
);

clockRoutes.post(
  '/clock/override',
  authenticate,
  branchScope,
  requireRole('MANAGER'),
  clockController.clockOverride,
);

export default clockRoutes;
