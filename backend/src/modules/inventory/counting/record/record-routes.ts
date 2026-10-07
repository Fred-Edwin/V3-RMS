import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { recordController } from './record-controller';

/**
 * Counting, `record/`: taking a count (C8 start options, C9 start, C10 save numbers, C11 section-end check, C12 sign preview,
 * C13 sign, C14 the person's own order for today). Every route authenticates and gates by capability; never a role list. The
 * literal paths (`/counts/start-options`, `/counts/section-order/today`) are registered before any `/counts/:id/...` path.
 */
const router = Router();

router.use(authenticate);

router.get('/counts/start-options', requireCapability('counts.record'), recordController.startOptions);
router.put('/counts/section-order/today', requireCapability('counts.record'), recordController.setSectionOrder);
router.post('/counts', requireCapability('counts.record'), recordController.start);
router.put('/counts/:id/lines', requireCapability('counts.record'), recordController.saveLines);
router.post('/counts/:id/check', requireCapability('counts.record'), recordController.check);
router.get('/counts/:id/sign-preview', requireCapability('counts.record'), recordController.signPreview);
router.post('/counts/:id/sign', requireCapability('counts.record'), recordController.sign);

export default router;
