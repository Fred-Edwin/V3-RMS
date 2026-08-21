import { Router } from 'express';
import { dispatchController } from '../controllers/dispatch-controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';

const dispatchRoutes = Router();

const canFulfil = requireRole('STORE_MANAGER', 'STORE_ATTENDANT', 'DIRECTOR', 'SYSTEM_ADMIN');
const canReceive = requireRole('DEPARTMENT_HEAD');
const canView = requireRole(
  'DEPARTMENT_HEAD',
  'MANAGER',
  'DIRECTOR',
  'SYSTEM_ADMIN',
  'STORE_MANAGER',
  'STORE_ATTENDANT',
);

dispatchRoutes.get('/dispatches/queue', authenticate, canFulfil, dispatchController.queue);
dispatchRoutes.get('/dispatches', authenticate, canView, dispatchController.list);
dispatchRoutes.get('/dispatches/:id', authenticate, canView, dispatchController.getById);
dispatchRoutes.post(
  '/dispatches/requisitions/:requisitionId/fulfil',
  authenticate,
  canFulfil,
  dispatchController.fulfilRequisition,
);
dispatchRoutes.patch(
  '/dispatches/requisitions/:requisitionId/reject',
  authenticate,
  canFulfil,
  dispatchController.rejectFulfilment,
);
dispatchRoutes.post('/dispatches/unsolicited', authenticate, canFulfil, dispatchController.createUnsolicited);
dispatchRoutes.patch('/dispatches/:id/confirm', authenticate, canFulfil, dispatchController.confirmDispatch);
dispatchRoutes.patch('/dispatches/:id/receive', authenticate, canReceive, dispatchController.receive);

export default dispatchRoutes;
