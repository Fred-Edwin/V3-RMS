import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { CAPABILITIES, requireCapability, type Capability } from '../_shared/workforce-access';
import { confirmController } from './confirm/confirm-controller';
import { pageController } from './page/page-controller';
import { versionsController } from './versions/versions-controller';

/**
 * The Rules endpoints. Every route: authenticate, then a capability (never a role list). The route only asks "can this
 * person do anything of this kind"; which field, which site and which scope is decided by the service on the actual change.
 * Literal paths come before `/:group`.
 */
const R = '/workforce/rules';
const router = Router();

const EDIT_ANY: Capability[] = CAPABILITIES.filter((capability) => capability.startsWith('rules.edit.'));
const CONFIRM_ANY: Capability[] = CAPABILITIES.filter((capability) => capability.startsWith('rules.confirm.'));

router.get(`${R}/effective`, authenticate, requireCapability('rules.read'), pageController.effective);
router.get(`${R}/access-table`, authenticate, requireCapability('rules.read'), pageController.accessTable);
router.post(`${R}/versions/:id/confirm`, authenticate, requireCapability(...CONFIRM_ANY), confirmController.confirm);
router.post(`${R}/versions/:id/withdraw`, authenticate, requireCapability(...EDIT_ANY), versionsController.withdraw);

router.get(`${R}/:group`, authenticate, requireCapability('rules.read'), pageController.page);
router.get(`${R}/:group/versions`, authenticate, requireCapability('rules.read'), versionsController.history);
router.post(`${R}/:group/versions/preview`, authenticate, requireCapability(...EDIT_ANY), versionsController.preview);
router.post(`${R}/:group/versions`, authenticate, requireCapability(...EDIT_ANY), versionsController.create);

export default router;
