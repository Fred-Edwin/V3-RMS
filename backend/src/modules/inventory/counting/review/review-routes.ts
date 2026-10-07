import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { reviewController } from './review-controller';

/**
 * Counting, `review/`: the Manager reviews a submitted count (C27 decide lines, C28 approve preview, C29 approve with a PIN) and the
 * Director marks flagged lines seen (C30). Every route authenticates and gates by capability; never a role list. The literal path
 * `POST /counts/seen` is registered before any `/counts/:id/...` path.
 */
const router = Router();

router.use(authenticate);

router.post('/counts/seen', requireCapability('counts.acknowledge'), reviewController.markSeen);
router.post('/counts/:id/decisions', requireCapability('counts.resolve'), reviewController.decide);
router.get('/counts/:id/approve-preview', requireCapability('counts.resolve'), reviewController.approvePreview);
router.post('/counts/:id/approve', requireCapability('counts.resolve'), reviewController.approve);

export default router;
