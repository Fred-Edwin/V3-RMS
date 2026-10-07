import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { recordController } from './record-controller';

const router = Router();

router.use(authenticate);

router.get('/inventory/prep/outputs', requireCapability('prep.record'), recordController.outputs);
router.get('/inventory/prep/prep-again', requireCapability('prep.record'), recordController.prepAgain);
// `/runs/check` is a literal path under /runs; the runs router only has GET /runs/:id, so nothing clashes.
router.post('/inventory/prep/runs/check', requireCapability('prep.record'), recordController.check);
router.post('/inventory/prep/runs', requireCapability('prep.record'), recordController.record);

export default router;
