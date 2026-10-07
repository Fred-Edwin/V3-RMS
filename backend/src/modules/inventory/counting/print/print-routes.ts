import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { printController } from './print-controller';

/**
 * Counting, `print/`: C6 the printed count record (readers only: it shows expected stock) and C7 the blank count sheet (readers and
 * the Attendant: no stock figures). The literal `/counts/blank-sheet` is registered before `/counts/:id/print`.
 */
const router = Router();

router.use(authenticate);

router.get('/counts/blank-sheet', requireCapability('counts.read', 'counts.record'), printController.blankSheet);
router.get('/counts/:id/print', requireCapability('counts.read'), printController.record);

export default router;
