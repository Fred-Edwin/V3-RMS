import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { runsController } from './runs-controller';

const router = Router();

router.use(authenticate);

// `/runs/summary` sits before the param route; `/runs/export` lives in the review router, which routes/index.ts mounts before this one.
router.get('/inventory/prep/runs', requireCapability('prep.read'), runsController.list);
router.get('/inventory/prep/runs/summary', requireCapability('prep.read_flags'), runsController.summary);
router.get('/inventory/prep/runs/:id', requireCapability('prep.read'), runsController.get);

export default router;
