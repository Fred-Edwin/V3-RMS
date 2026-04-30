import { Router } from 'express';
import { staffController } from '../controllers/staff-controller';
import { authenticate } from '../middleware/authenticate';
import { branchScope } from '../middleware/branch-scope';
import { requireRole } from '../middleware/rbac';

const staffRoutes = Router();

staffRoutes.post(
  '/staff',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  staffController.create,
);
staffRoutes.get(
  '/staff/messaging-contacts',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'SYSTEM_ADMIN', 'WAITER', 'CHEF', 'BARISTA'),
  staffController.messagingContacts,
);
staffRoutes.get(
  '/staff',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN', 'ACCOUNTANT', 'WAITER', 'CHEF', 'BARISTA', 'KITCHEN_DISPLAY', 'BARISTA_DISPLAY'),
  staffController.list,
);
staffRoutes.get(
  '/staff/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  staffController.getById,
);
staffRoutes.patch(
  '/staff/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'HR_MANAGER', 'DIRECTOR', 'SYSTEM_ADMIN'),
  staffController.update,
);
staffRoutes.patch(
  '/staff/:id/deactivate',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'SYSTEM_ADMIN'),
  staffController.deactivate,
);
staffRoutes.patch(
  '/staff/:id/reactivate',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'SYSTEM_ADMIN'),
  staffController.reactivate,
);
staffRoutes.patch(
  '/staff/:id/reset-password',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'SYSTEM_ADMIN'),
  staffController.resetPassword,
);
staffRoutes.delete(
  '/staff/:id',
  authenticate,
  branchScope,
  requireRole('MANAGER', 'SYSTEM_ADMIN'),
  staffController.hardDelete,
);

export default staffRoutes;
