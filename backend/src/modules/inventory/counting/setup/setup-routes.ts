import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { setupController } from './setup-controller';

/**
 * Counting, `setup/`: Count setup (C15 the page, C16 one section's items, C17 add a section, C18 save the order, C19 add-items
 * search, C20 add items, C21 move an item, C22 undo a move). Every route authenticates and gates by capability; never a role list.
 * C21 is `counts.record` on purpose: the Attendant moves an item from their phone, the Manager sees it and may undo it.
 */
const router = Router();

router.use(authenticate);

router.get('/count-setup', requireCapability('counts.read'), setupController.view);
router.get('/count-setup/add-items', requireCapability('counts.setup'), setupController.addableItems);
router.get('/count-setup/sections/:id/items', requireCapability('counts.read'), setupController.sectionItems);
router.post('/count-setup/sections/:id/items', requireCapability('counts.setup'), setupController.addItems);
router.post('/count-setup/sections', requireCapability('counts.setup'), setupController.addSection);
router.put('/count-setup/layout', requireCapability('counts.setup'), setupController.saveLayout);
router.post('/count-setup/items/:itemId/move', requireCapability('counts.record'), setupController.moveItem);
router.post('/count-setup/moves/:id/undo', requireCapability('counts.setup'), setupController.undoMove);

export default router;
