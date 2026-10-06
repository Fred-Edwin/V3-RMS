import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { rulesController } from './rules-controller';

const router = Router();

// Two reads only in slice 0. The write endpoints (and the Rules screens) are slice 4 and call rulesService.createVersion / confirmVersion.
router.get('/workforce/rules/effective', authenticate, requireCapability('rules.read'), rulesController.effective);
router.get('/workforce/rules/:group/versions', authenticate, requireCapability('rules.read'), rulesController.versions);

export default router;
