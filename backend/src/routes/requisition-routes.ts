import { Router } from 'express';
import { requisitionController } from '../controllers/requisition-controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole, requireDepartmentHead } from '../middleware/rbac';
import { allowDepartmentHead } from '../middleware/allow-department-head';

const requisitionRoutes = Router();

const canRaise = requireDepartmentHead;
const canApprove = requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN');
const canView = allowDepartmentHead(
  requireRole('MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'STORE_MANAGER', 'STORE_ATTENDANT'),
);

requisitionRoutes.get('/requisitions/orderable-items', authenticate, canRaise, requisitionController.listOrderableItems);
requisitionRoutes.get('/requisitions', authenticate, canView, requisitionController.list);
requisitionRoutes.get('/requisitions/:id', authenticate, canView, requisitionController.getById);
requisitionRoutes.post('/requisitions', authenticate, canRaise, requisitionController.raise);
requisitionRoutes.patch('/requisitions/:id/approve', authenticate, canApprove, requisitionController.approve);
requisitionRoutes.patch('/requisitions/:id/reject', authenticate, canApprove, requisitionController.reject);
requisitionRoutes.patch('/requisitions/:id/cancel', authenticate, canRaise, requisitionController.cancel);
requisitionRoutes.patch('/requisitions/:id/resubmit', authenticate, canRaise, requisitionController.editAndResubmit);

export default requisitionRoutes;
