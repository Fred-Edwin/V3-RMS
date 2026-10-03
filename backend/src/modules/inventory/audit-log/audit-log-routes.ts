import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/central-store-access';
import { auditLogController } from './audit-log-controller';

const router = Router();

router.use(authenticate);

// Read-only. Every desktop role reads it (central-store-access.ts).
router.get('/inventory/audit-log', requireCapability('audit.read'), auditLogController.list);

export default router;
