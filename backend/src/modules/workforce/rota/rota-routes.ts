import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { registerChangeNotices } from './changes/change-notifier';
import { rotaController as c } from './rota-controller';
import { templatesController as t } from './templates/templates-controller';

/**
 * The Rota endpoints (T1 to T5, G1 to G7). Every route: authenticate, then attachWorkforceSubject (head rows), then the
 * capability; scope is checked in the service on the actual record. There is no publish or amend route: edits are live.
 */
registerChangeNotices();
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;
const R = '/workforce/rota';

router.get(`${R}/templates`, ...base, requireCapability('rota.read'), t.list); // T1
router.post(`${R}/templates`, ...base, requireCapability('rota.template_write'), t.create); // T2
router.patch(`${R}/templates/:id`, ...base, requireCapability('rota.template_write'), t.update); // T3
router.post(`${R}/templates/:id/retire`, ...base, requireCapability('rota.template_write'), t.retire); // T4
router.post(`${R}/templates/:id/restore`, ...base, requireCapability('rota.template_write'), t.restore); // T5

router.get(`${R}/week`, ...base, requireCapability('rota.read'), c.week); // G1
router.get(`${R}/week/print`, ...base, requireCapability('rota.read'), c.print); // G2
router.get(`${R}/mine`, ...base, requireCapability('rota.read'), c.mine); // G3
router.put(`${R}/cells`, ...base, requireCapability('rota.write'), c.setCells); // G4
router.post(`${R}/fill`, ...base, requireCapability('rota.write'), c.fill); // G5
router.post(`${R}/pattern`, ...base, requireCapability('rota.write'), c.pattern); // G5
router.post(`${R}/copy/preview`, ...base, requireCapability('rota.write'), c.copyPreview); // G6
router.post(`${R}/copy`, ...base, requireCapability('rota.write'), c.copy); // G7

export default router;
