import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { countsController } from './counts-controller';

/**
 * Counting, `counts/`: the Counts screens (C1 summary, C2 list, C3 flagged to the Director, C4 repeat shortfalls, C5 one count).
 * Every route authenticates and gates by capability; never a role list. `GET /counts/:id` matches any single segment, so it is
 * registered LAST, after every literal path here (and this router is mounted after print, record and review).
 */
const router = Router();

router.use(authenticate);

router.get('/counts/summary', requireCapability('counts.read'), countsController.summary);
router.get('/counts/flagged', requireCapability('counts.read'), countsController.flagged);
router.get('/counts/repeat-shortfalls', requireCapability('counts.read'), countsController.repeatShortfalls);
router.get('/counts', requireCapability('counts.read'), countsController.list);
// counts.read for any count; counts.record for the Attendant's OWN (the service answers 404 for anyone else's).
router.get('/counts/:id', requireCapability('counts.read', 'counts.record'), countsController.detail);

export default router;
