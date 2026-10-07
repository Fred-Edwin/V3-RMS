import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { reviewController } from './review-controller';

const router = Router();

router.use(authenticate);

// Mounted BEFORE the runs router in routes/index.ts: `/runs/export` must be found before `/runs/:id` swallows it.
router.get('/inventory/prep/runs/export', requireCapability('prep.read_flags'), reviewController.exportCsv);
router.post('/inventory/prep/runs/:id/review', requireCapability('prep.review'), reviewController.review);
router.get('/inventory/prep/needs-a-look/count', requireCapability('prep.read_flags'), reviewController.count);
router.get('/inventory/prep/needs-a-look', requireCapability('prep.read_flags'), reviewController.needsLook);

export default router;
