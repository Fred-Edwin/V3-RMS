import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { settingsController } from './settings-controller';

/**
 * Counting, `settings/`: Count settings (C23 read, C24 what-if preview, C25 range and repeat-shortfall flag, C26 the Director
 * alert amount). Every route authenticates and gates by capability; never a role list.
 */
const router = Router();

router.use(authenticate);

router.get('/count-settings', requireCapability('counts.read'), settingsController.get);
// The literal `/preview` and `/director-alert` paths sit under `/count-settings`, which has no `:id`, so nothing swallows them.
router.get('/count-settings/preview', requireCapability('counts.read'), settingsController.preview);
router.put('/count-settings', requireCapability('counts.setup'), settingsController.updateRange);
router.put('/count-settings/director-alert', requireCapability('counts.set_director_alert'), settingsController.updateDirectorAlert);

export default router;
