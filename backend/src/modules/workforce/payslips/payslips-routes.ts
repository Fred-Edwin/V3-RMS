import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { readsController as reads } from './reads/reads-controller';
import { requireUnlock } from './unlock/unlock-middleware';
import { unlockController as unlock } from './unlock/unlock-controller';

/**
 * What staff see (Segment 3, PD1 to PD18). Every route: authenticate, attachWorkforceSubject, the capability. The routes that show pay
 * also need a live unlock token (`x-payslip-unlock`) bound to the person and the phone (`x-device-id`), so the code is enforced by the
 * server (PD7). A payslip, P9 or sheet that is not the caller's is a 404. No requireRole in this module.
 *   S1 list (no code needed) · unlock · first code · lock · S2 home · S4 history · S3 one payslip · versions · document (A4 PDF)
 *   P9 status · P9 document · HR/Accountant open anyone's · the Director's daily openings · build a P9 for a leaver · confirm the P9 layout
 */
const P = '/workforce/payslips';
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;
const mine = [...base, requireCapability('me.payslip')] as const;
const unlocked = [...mine, requireUnlock] as const;

router.get(`${P}/me`, ...mine, reads.list);
router.post(`${P}/me/unlock`, ...mine, unlock.unlock);
router.post(`${P}/me/code`, ...mine, unlock.setCode);
router.post(`${P}/me/lock`, ...mine, unlock.lock);
router.get(`${P}/me/home`, ...unlocked, reads.home);
router.get(`${P}/me/history`, ...unlocked, reads.history);
router.get(`${P}/me/p9/:year`, ...mine, reads.p9Status);
router.get(`${P}/me/p9/:year/document`, ...unlocked, reads.p9Document);
router.get(`${P}/me/:id`, ...unlocked, reads.detail);
router.get(`${P}/me/:id/versions`, ...unlocked, reads.versions);
router.get(`${P}/me/:id/document`, ...unlocked, reads.document);

router.get(`${P}/opens`, ...base, requireCapability('audit.read.payslip_access'), reads.openings);
router.post(`${P}/p9/format/confirm`, ...base, requireCapability('p9.confirm_format'), reads.p9Confirm);
router.post(`${P}/p9/:year/people/:employeeId/generate`, ...base, requireCapability('p9.generate'), reads.p9Generate);
router.get(`${P}/:id`, ...base, requireCapability('payslip.read_any'), reads.openAny);
router.get(`${P}/:id/document`, ...base, requireCapability('payslip.read_any'), reads.documentAny);

export default router;
