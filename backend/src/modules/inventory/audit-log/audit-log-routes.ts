import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireRole } from '../../../middleware/rbac';
import { auditLogController } from './audit-log-controller';

const router = Router();

router.use(authenticate);

// Read-only. The Store Manager makes the changes; the Accountant and Director read them.
router.get('/inventory/audit-log', requireRole('STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'), auditLogController.list);

export default router;
