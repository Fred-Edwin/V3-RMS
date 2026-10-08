// kept for the branch-day refactor: delete when branch day is redone
import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireRole } from '../../../middleware/rbac';
import { thresholdsController } from './thresholds-controller';

const router = Router();

router.use(authenticate);

// The Branch Manager's own branch thresholds (branch day reads them). The hub's settings are the new
// `/inventory/stock/count-settings` routes (counting/settings/); the Store Manager's and the Director's old
// writes here are gone.
router.get('/inventory/thresholds', requireRole('MANAGER'), thresholdsController.get);
router.put('/inventory/thresholds', requireRole('MANAGER'), thresholdsController.update);

export default router;
