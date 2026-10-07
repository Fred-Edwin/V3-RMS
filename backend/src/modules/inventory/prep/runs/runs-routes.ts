import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { runsController } from './runs-controller';

const router = Router();

router.use(authenticate);

// Slice 4 registers `/runs/summary` and `/runs/export` before this param route.
router.get('/inventory/prep/runs', requireCapability('prep.read'), runsController.list);
router.get('/inventory/prep/runs/:id', requireCapability('prep.read'), runsController.get);

export default router;
