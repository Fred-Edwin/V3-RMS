import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { recipesController } from './recipes-controller';

/** Usual recipes (API_CONTRACT.md §33.3 #1 to #3). Mounted at `/inventory/prep`. Capabilities, never roles. */
const router = Router();

router.use(authenticate);

router.get('/recipes', requireCapability('prep.read'), recipesController.list);
router.get('/recipes/:itemId', requireCapability('prep.read'), recipesController.get);
router.put('/recipes/:itemId', requireCapability('prep.recipes_write'), recipesController.save);

export default router;
