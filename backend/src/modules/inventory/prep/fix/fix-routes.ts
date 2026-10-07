import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { fixController } from './fix-controller';

const router = Router();

router.use(authenticate);

// Paths one segment deeper than `GET /runs/:id` (runs/), so nothing clashes with it or with `/runs/check`.
router.post('/inventory/prep/runs/:id/correct', requireCapability('prep.record'), fixController.correct);
router.post('/inventory/prep/runs/:id/cancel', requireCapability('prep.record'), fixController.cancel);
router.get('/inventory/prep/runs/:id/cancel-preview', requireCapability('restock.read'), fixController.cancelPreview);

export default router;
