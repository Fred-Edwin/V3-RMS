import { Router } from 'express';
import { staffTransferController } from '../controllers/staff-transfer-controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/rbac';

const staffTransferRoutes = Router();

staffTransferRoutes.post(
  '/staff/transfers',
  authenticate,
  requireRole('DIRECTOR', 'HR_MANAGER', 'SYSTEM_ADMIN'),
  staffTransferController.create,
);

staffTransferRoutes.get(
  '/staff/:id/transfers',
  authenticate,
  requireRole('DIRECTOR', 'HR_MANAGER', 'SYSTEM_ADMIN'),
  staffTransferController.listByUser,
);

export default staffTransferRoutes;
