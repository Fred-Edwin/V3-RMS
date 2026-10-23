import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { auditController as c } from './audit-controller';

/**
 * The company Audit log and Activity on my record (6a A1 to A9). The log's routes carry no single capability: what a person may read
 * is one capability per category, applied inside the query, and a person with none gets a 404 (the log does not admit it exists).
 * The chain check needs `audit.verify_chain`; "Activity on my record" needs `audit.read_own` and only ever reads the signed-in person.
 */
const P = '/workforce/audit';
const router = Router();
const signedIn = [authenticate, attachWorkforceSubject] as const;
const mine = [...signedIn, requireCapability('audit.read_own')] as const;

router.get(`${P}/entries`, ...signedIn, c.list);
router.get(`${P}/entries/:id`, ...signedIn, c.detail);
router.get(`${P}/facets`, ...signedIn, c.facets);
router.get(`${P}/actors`, ...signedIn, c.actors);
router.get(`${P}/export`, ...signedIn, c.export);
router.post(`${P}/chain/check`, ...signedIn, requireCapability('audit.verify_chain'), c.chain);

router.get(`${P}/me`, ...mine, c.mine);
router.get(`${P}/me/:id`, ...mine, c.mineOne);
router.post(`${P}/me/:id/answer`, ...mine, c.answer);

export default router;
